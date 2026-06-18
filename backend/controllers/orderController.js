const Order = require('../models/Order');
const Notification = require('../models/Notification');
const SpecialOffer = require('../models/SpecialOffer');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const PaymentOption = require('../models/PaymentOption');
const { getSenderDetails, isValidEmail, sendBrevoEmailToRecipients } = require('../utils/brevoMailer');

function normalizeOrderItems(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => {
            const productId = Number(item?.id || item?.product_id || 0);
            const specialOfferId = Number(item?.special_offer_id || item?.specialOfferId || 0);
            const quantity = Math.trunc(Number(item?.quantity || 0));
            return {
                ...item,
                productId,
                specialOfferId,
                quantity
            };
        })
        .filter((item) => {
            const hasProductRef = Number.isInteger(item.productId) && item.productId > 0;
            const hasSpecialOfferRef = Number.isInteger(item.specialOfferId) && item.specialOfferId > 0;
            return Number.isFinite(item.quantity) && item.quantity > 0 && (hasProductRef || hasSpecialOfferRef);
        });
}

function parseSizeOptions(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_e) {
            return [];
        }
    }
    if (typeof value === 'object') return Array.isArray(value) ? value : [];
    return [];
}

function resolveProductUnitPrice(productRow, selectedSize) {
    const fallback = Number(productRow?.price || 0);
    const basePrice = Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
    if (!selectedSize) return basePrice;

    const options = parseSizeOptions(productRow?.size_options);
    const selected = String(selectedSize).trim().toLowerCase();
    const match = options.find((opt) => {
        const optVal = String(opt?.value ?? opt?.label ?? '').trim().toLowerCase();
        return optVal === selected;
    });
    const optionPrice = Number(match?.price);
    // If size has a valid price, use it; otherwise fall back to base product price
    if (Number.isFinite(optionPrice)) return optionPrice;
    return basePrice;
}

async function validateAndReserveStock(connection, items) {
    const failures = [];

    const requestedByProduct = new Map();
    const requestedBySpecialOffer = new Map();
    for (const item of items) {
        if (Number.isInteger(item.specialOfferId) && item.specialOfferId > 0) {
            requestedBySpecialOffer.set(item.specialOfferId, (requestedBySpecialOffer.get(item.specialOfferId) || 0) + item.quantity);
            continue;
        }
        requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) || 0) + item.quantity);
    }

    const productIds = [...requestedByProduct.keys()];
    if (productIds.length === 0 && requestedBySpecialOffer.size === 0) {
        return { ok: false, failures: [{ reason: 'empty_order' }] };
    }

    const productById = new Map();
    if (productIds.length > 0) {
        const placeholders = productIds.map(() => '?').join(',');
        const [rows] = await connection.execute(
            `SELECT id, name, stock, price, image, size_options FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
            productIds
        );
        rows.forEach((row) => productById.set(Number(row.id), row));
    }

    for (const [productId, requestedQty] of requestedByProduct.entries()) {
        const product = productById.get(Number(productId));
        if (!product) {
            failures.push({ productId, reason: 'not_found', requestedQty });
            continue;
        }

        const available = Number(product.stock || 0);
        if (available < requestedQty) {
            failures.push({
                productId,
                productName: product.name,
                reason: 'insufficient_stock',
                availableQty: available,
                requestedQty
            });
        }
    }

    if (failures.length > 0) {
        return { ok: false, failures };
    }

    const allOffers = SpecialOffer.findAll();
    const offersById = new Map(allOffers.map((offer) => [Number(offer.id), offer]));
    const offerStockSnapshot = allOffers.map((offer) => ({ id: offer.id, stock: Number(offer.stock ?? 100) }));

    for (const [specialOfferId, requestedQty] of requestedBySpecialOffer.entries()) {
        const offer = offersById.get(Number(specialOfferId));
        if (!offer) {
            failures.push({ specialOfferId, reason: 'special_offer_not_found', requestedQty });
            continue;
        }

        const available = Number(offer.stock ?? 100);
        if (!Number.isFinite(available) || available < requestedQty) {
            failures.push({
                specialOfferId,
                productName: offer.name,
                reason: 'insufficient_stock',
                availableQty: Number.isFinite(available) ? available : 0,
                requestedQty
            });
        }
    }

    if (failures.length > 0) {
        return { ok: false, failures };
    }

    for (const [productId, quantity] of requestedByProduct.entries()) {
        const product = productById.get(Number(productId));
        const [updateResult] = await connection.execute(
            'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
            [quantity, productId, quantity]
        );
        if (!updateResult || updateResult.affectedRows !== 1) {
            failures.push({
                productId,
                productName: product?.name,
                reason: 'concurrent_stock_change',
                requestedQty: quantity
            });
        }
    }

    if (failures.length > 0) {
        return { ok: false, failures };
    }

    if (requestedBySpecialOffer.size > 0) {
        const nextOffers = allOffers.map((offer) => {
            const requestedQty = requestedBySpecialOffer.get(Number(offer.id));
            if (!requestedQty) return offer;
            const currentStock = Number(offer.stock ?? 100);
            return { ...offer, stock: Math.max(0, Math.trunc(currentStock - requestedQty)) };
        });
        SpecialOffer.saveAll(nextOffers);
    }

    const reservedItems = items.map((item) => {
        if (Number.isInteger(item.specialOfferId) && item.specialOfferId > 0) {
            const offer = offersById.get(Number(item.specialOfferId));
            const safePrice = Number(offer?.currentPrice || 0);
            return {
                id: `special-offer-${item.specialOfferId}`,
                special_offer_id: item.specialOfferId,
                item_type: 'special_offer',
                name: item.name || offer?.name || `Special Offer #${item.specialOfferId}`,
                price: safePrice,
                quantity: item.quantity,
                image: item.image || offer?.image || null,
                selected_size: item.selected_size || item.selectedSize || null
            };
        }

        const product = productById.get(Number(item.productId));
        const selectedSize = item.selected_size || item.selectedSize || null;
        const safePrice = resolveProductUnitPrice(product, selectedSize);
        return {
            id: item.productId,
            name: item.name || product?.name || `Product #${item.productId}`,
            price: safePrice,
            quantity: item.quantity,
            image: item.image || product?.image || null,
            selected_size: selectedSize
        };
    });

    const totalAmount = reservedItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    return { ok: true, reservedItems, totalAmount, offerStockSnapshot };
}

function restoreSpecialOfferStock(snapshot) {
    if (!Array.isArray(snapshot) || snapshot.length === 0) return;
    const allOffers = SpecialOffer.findAll();
    const snapshotById = new Map(snapshot.map((item) => [Number(item.id), Number(item.stock ?? 100)]));
    const restored = allOffers.map((offer) => {
        const stock = snapshotById.get(Number(offer.id));
        if (!Number.isFinite(stock)) return offer;
        return { ...offer, stock: Math.max(0, Math.trunc(stock)) };
    });
    SpecialOffer.saveAll(restored);
}

function getAdminNotificationEmail() {
    return (process.env.ADMIN_NOTIFICATION_EMAIL || 'avatawebsite@gmail.com').trim();
}

function shouldForceAllOrderEmailToAdmin() {
    return ['1', 'true', 'yes', 'on'].includes(String(process.env.FORCE_ALL_ORDER_EMAIL_TO_ADMIN || '').toLowerCase());
}

function shouldSendEmailsForOrder(order) {
    return order?.order_source !== 'direct_no_email';
}

function getOrderEmailRecipients(order) {
    const adminNotificationEmail = getAdminNotificationEmail();
    const recipients = shouldForceAllOrderEmailToAdmin()
        ? [adminNotificationEmail]
        : [adminNotificationEmail, order?.customer_email];
    const normalized = recipients
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(v => isValidEmail(v));
    return [...new Set(normalized)];
}

function shouldSendCustomerStatusEmail(order) {
    const source = String(order?.order_source || '').trim().toLowerCase();
    return source === 'email' && isValidEmail(order?.customer_email);
}

function getStatusUpdateRecipients(order) {
    const recipients = [getAdminNotificationEmail()];
    if (shouldSendCustomerStatusEmail(order)) {
        recipients.push(order.customer_email);
    }
    const normalized = recipients
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(v => isValidEmail(v));
    return [...new Set(normalized)];
}

// --- Multer setup for payment proof uploads ---
const proofDir = path.join(__dirname, '../uploads/payment_proofs');
if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, proofDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `proof-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.jfif', '.png', '.pdf', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tiff'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image (jpg, jpeg, jfif, png, webp, gif, bmp, tiff, heic, heif) and PDF files are allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

exports.uploadProofMiddleware = (req, res, next) => {
    upload.single('payment_proof_file')(req, res, (error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, message: 'File is too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ success: false, message: error.message || 'Upload failed.' });
        }
        return res.status(400).json({ success: false, message: error.message || 'Invalid payment proof file.' });
    });
};

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '../uploads/receipts');
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

const RECEIPT_ROUTE_PREFIX = '/uploads/receipts/';

function isReceiptPdfPath(value) {
    return typeof value === 'string'
        && value.startsWith(RECEIPT_ROUTE_PREFIX)
        && value.toLowerCase().endsWith('.pdf');
}

function resolveReceiptAbsolutePath(receiptPath) {
    if (!isReceiptPdfPath(receiptPath)) return null;
    return path.join(__dirname, '..', receiptPath.replace(/^\//, ''));
}

function resolveReceiptItemImageAbsolutePath(imageValue) {
    const raw = String(imageValue || '').trim();
    if (!raw) return null;

    const normalized = raw.replace(/\\/g, '/');

    // Convert HTTP URL to local uploads path when possible.
    if (/^https?:\/\//i.test(normalized)) {
        try {
            const parsed = new URL(normalized);
            const pathname = decodeURIComponent(String(parsed.pathname || '')).replace(/\\/g, '/');
            if (pathname.startsWith('/uploads/')) {
                const local = path.join(__dirname, '..', pathname.replace(/^\//, ''));
                return fs.existsSync(local) ? local : null;
            }
            return null;
        } catch (_urlErr) {
            return null;
        }
    }

    if (normalized.startsWith('/uploads/')) {
        const local = path.join(__dirname, '..', normalized.replace(/^\//, ''));
        return fs.existsSync(local) ? local : null;
    }

    if (normalized.startsWith('uploads/')) {
        const local = path.join(__dirname, '..', normalized);
        return fs.existsSync(local) ? local : null;
    }

    const local = path.isAbsolute(raw) ? raw : path.join(__dirname, '..', raw);
    return fs.existsSync(local) ? local : null;
}

function ensureReceiptSpace(doc, neededHeight) {
    const available = doc.page.height - doc.page.margins.bottom - doc.y;
    if (available < neededHeight) {
        doc.addPage();
    }
}

function isOrderFullyPaid(order) {
    const paymentStatus = String(order?.payment_status || '').toLowerCase();
    const orderStatus = String(order?.status || '').toLowerCase();
    const verificationStatus = String(order?.verification_status || '').toLowerCase();
    return paymentStatus === 'paid'
        || paymentStatus === 'verified'
        || verificationStatus === 'approved'
        || orderStatus === 'paid'
        || orderStatus === 'completed';
}

function getReceiptPaymentStatusLabel(order) {
    const orderStatus = String(order?.status || '').toLowerCase();
    if (orderStatus === 'completed') return 'Completed';
    if (isOrderFullyPaid(order)) return 'Paid';
    return 'Pending';
}

function isReceiptEligible(order) {
    if (!order) return false;
    const isPaymentVerified = isOrderFullyPaid(order);
    const isDelivered = ['Delivered', 'delivered', 'Shipped', 'shipped', 'Completed', 'completed'].includes(order.status);
    return isPaymentVerified && isDelivered;
}

function sanitizeTransportAmount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    if (parsed < 0) return 0;
    return Math.round(parsed * 100) / 100;
}

// Helper function to check and generate receipt if conditions are met
async function checkAndGenerateReceipt(orderId, options = {}) {
    try {
        const force = Boolean(options?.force);
        const order = await Order.findById(orderId);
        if (!order) return;

        // Check if receipt already exists
        if (!force && isReceiptPdfPath(order.payment_receipt)) {
            const existingReceipt = resolveReceiptAbsolutePath(order.payment_receipt);
            if (existingReceipt && fs.existsSync(existingReceipt)) {
                console.log(`✅ Receipt already exists for order ${orderId}`);
                return order.payment_receipt;
            }
        }

        if (order.payment_receipt && !isReceiptPdfPath(order.payment_receipt)) {
            console.warn(`⚠️ Ignoring non-file payment_receipt value for order ${orderId}: ${order.payment_receipt}`);
        }

        if (!isReceiptEligible(order)) {
            console.log(`⏳ Receipt not yet ready for order ${orderId} - Payment: ${order.payment_status}, Status: ${order.status}`);
            return null;
        }

        console.log(`📄 Generating receipt for order ${orderId} - Payment: ${order.payment_status}, Status: ${order.status}${force ? ' (forced)' : ''}`);
        const receiptPath = await generateReceiptPdf(order);
        await Order.update(orderId, { payment_receipt: receiptPath });
        console.log(`✅ Receipt generated and saved: ${receiptPath}`);
        return receiptPath;
    } catch (error) {
        console.error(`❌ Error generating receipt for order ${orderId}:`, error);
        return null;
    }
}

async function generateReceiptPdf(order) {
    return new Promise((resolve, reject) => {
        try {
            const filename = `receipt-${order.id || Date.now()}.pdf`;
            const filePath = path.join(receiptsDir, filename);
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const paymentOptionsPromise = PaymentOption.getCurrent().catch(() => ({}));

            const left = doc.page.margins.left;
            const right = doc.page.width - doc.page.margins.right;
            const tableWidth = right - left;
            const createdAt = new Date(order.created_at || Date.now());
            const dateText = createdAt.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            const timeText = createdAt.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const invoiceNo = String(order.id || Date.now()).padStart(3, '0');

            const toNum = (v) => Number(v) || 0;
            const items = Array.isArray(order.items) ? order.items : [];
            const productsSubTotal = items.reduce((sum, it) => sum + (toNum(it.price) * Math.max(1, toNum(it.quantity || 1))), 0);
            const productsTotal = toNum(order.total_amount) > 0 ? toNum(order.total_amount) : productsSubTotal;
            const taxRate = 0.18;
            const subTotal = productsTotal > 0 ? (productsTotal / (1 + taxRate)) : productsSubTotal;
            const taxAmount = Math.max(0, productsTotal - subTotal);
            const transport = sanitizeTransportAmount(order.receipt_transport);
            const grandTotal = productsTotal + transport;

            // Header with logo and invoice badge.
            const logoCandidates = [
                path.join(__dirname, '../assets', 'logo.png'),
                path.join(__dirname, '../../frontend/public/logo-avata.jpeg')
            ];
            const logoPath = logoCandidates.find((p) => fs.existsSync(p));
            if (logoPath) {
                try {
                    doc.image(logoPath, left, 28, { fit: [150, 55], align: 'left', valign: 'top' });
                } catch (e) {
                    console.warn('Failed to add logo to receipt', e);
                    doc.fontSize(17).font('Helvetica-Bold').fillColor('#0f2d75').text('AVATA TRADING LTD', left, 40);
                }
            } else {
                doc.fontSize(17).font('Helvetica-Bold').fillColor('#0f2d75').text('AVATA TRADING LTD', left, 40);
            }

            const badgeW = 130;
            const badgeH = 26;
            const badgeX = right - badgeW;
            const badgeY = 32;
            doc.save();
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 12).fill('#0f2d75');
            doc.restore();
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('Proforma Invoice', badgeX, badgeY + 8, { width: badgeW, align: 'center' });

            let y = 96;
            doc.strokeColor('#d7dce7').lineWidth(1).moveTo(left, y).lineTo(right, y).stroke();
            y += 12;

            doc.fillColor('#0b1b3f').font('Helvetica-Bold').fontSize(10).text(`Date: ${dateText}  Time: ${timeText}`, left, y);
            doc.text(`Invoice No: ${invoiceNo}`, right - 150, y, { width: 150, align: 'right' });
            y += 22;
            doc.strokeColor('#e3e8f0').lineWidth(1).moveTo(left, y).lineTo(right, y).stroke();
            y += 16;

            // Company and billing block.
            const customerName = order.customer_name || order.user_full_name || 'Guest Customer';
            const customerEmail = order.customer_email || order.user_email || '';
            const customerPhone = order.customer_phone || '';
            const companyTitle = 'AVATA TRADING LTD';
            const companyAddress = 'Address: Gisozi / Gasabo COPCOM House';
            const companyPhone = '+250 788 565 590 / +250 788 305 811';
            const companyEmail = 'avatatd@gmail.com';

            doc.fillColor('#0f2d75').font('Helvetica-Bold').fontSize(11).text(companyTitle, left, y);
            doc.fillColor('#2b3b52').font('Helvetica').fontSize(9)
                .text(companyAddress, left, y + 14)
                .text(companyPhone, left, y + 27)
                .text(companyEmail, left, y + 40);

            doc.fillColor('#0f2d75').font('Helvetica-Bold').fontSize(10).text('Bill To:', right - 180, y, { width: 180, align: 'right' });
            doc.fillColor('#2b3b52').font('Helvetica-Bold').fontSize(11).text(customerName, right - 180, y + 14, { width: 180, align: 'right' });
            if (customerEmail) {
                doc.fillColor('#4a5568').font('Helvetica').fontSize(9).text(customerEmail, right - 180, y + 29, { width: 180, align: 'right' });
            }
            if (customerPhone) {
                doc.fillColor('#4a5568').font('Helvetica').fontSize(9).text(customerPhone, right - 180, y + 41, { width: 180, align: 'right' });
            }

            y += 72;

            const drawTableHeader = (headerY) => {
                const headerH = 26;
                const cols = [
                    { label: 'N°', width: 28, align: 'center' },
                    { label: 'Image', width: 56, align: 'center' },
                    { label: 'Description', width: 156, align: 'left' },
                    { label: 'Tax (18%)', width: 62, align: 'center' },
                    { label: 'QTY', width: 40, align: 'center' },
                    { label: 'Unit Price', width: 80, align: 'right' },
                    { label: 'Total', width: 93, align: 'right' }
                ];

                doc.save();
                doc.rect(left, headerY, tableWidth, headerH).fill('#0b3d91');
                doc.restore();

                let cx = left;
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
                cols.forEach((col, idx) => {
                    const textX = col.align === 'left' ? cx + 6 : cx;
                    doc.text(col.label, textX, headerY + 8, {
                        width: col.width - (col.align === 'left' ? 8 : 0),
                        align: col.align
                    });
                    if (idx < cols.length - 1) {
                        doc.strokeColor('#ffffff').opacity(0.25).lineWidth(0.7)
                            .moveTo(cx + col.width, headerY + 4)
                            .lineTo(cx + col.width, headerY + headerH - 4)
                            .stroke();
                    }
                    cx += col.width;
                });
                doc.opacity(1);

                return { headerH, cols };
            };

            const { headerH, cols } = drawTableHeader(y);
            y += headerH;

            const rowHMin = 54;
            const safeItems = items.length ? items : [{ name: 'No item details available', quantity: 1, price: productsTotal }];

            safeItems.forEach((it, idx) => {
                const lineQty = Math.max(1, toNum(it.quantity || 1));
                const linePrice = toNum(it.price);
                const lineTotal = lineQty * linePrice;
                const itemName = it.name || it.product_name || 'Product';
                const itemSize = it.selected_size ? `Size: ${it.selected_size}` : '';

                const descX = left + cols[0].width + cols[1].width;
                const descWidth = cols[2].width - 12;
                const descHeight = doc.heightOfString(itemName, { width: descWidth, align: 'left' });
                const sizeHeight = itemSize ? doc.heightOfString(itemSize, { width: descWidth, align: 'left' }) : 0;
                const rowH = Math.max(rowHMin, 20 + descHeight + (itemSize ? (sizeHeight + 2) : 0));

                ensureReceiptSpace(doc, rowH + 6);
                if (doc.y > y + 1) y = doc.y;

                if (y + rowH > doc.page.height - doc.page.margins.bottom - 90) {
                    doc.addPage();
                    y = doc.page.margins.top;
                    const tableHeader = drawTableHeader(y);
                    y += tableHeader.headerH;
                }

                if (idx % 2 === 0) {
                    doc.save();
                    doc.rect(left, y, tableWidth, rowH).fill('#f7fafe');
                    doc.restore();
                }
                doc.rect(left, y, tableWidth, rowH).strokeColor('#d9deea').lineWidth(0.8).stroke();

                let cx = left;
                for (let c = 0; c < cols.length - 1; c += 1) {
                    cx += cols[c].width;
                    doc.strokeColor('#e4e8f2').lineWidth(0.7).moveTo(cx, y).lineTo(cx, y + rowH).stroke();
                }

                // N
                doc.font('Helvetica').fontSize(9).fillColor('#243247').text(String(idx + 1), left, y + Math.max(18, (rowH / 2) - 4), { width: cols[0].width, align: 'center' });

                // Image
                const imgCellX = left + cols[0].width;
                const imagePath = resolveReceiptItemImageAbsolutePath(it?.image || it?.product_image || it?.image_url);
                const imageBox = { x: imgCellX + 8, y: y + 7, w: cols[1].width - 16, h: Math.min(40, rowH - 14) };
                doc.roundedRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h, 3).lineWidth(0.7).strokeColor('#cfd6e4').stroke();
                if (imagePath) {
                    try {
                        doc.image(imagePath, imageBox.x + 2, imageBox.y + 2, {
                            fit: [imageBox.w - 4, imageBox.h - 4],
                            align: 'center',
                            valign: 'center'
                        });
                    } catch (_err) {
                        doc.fillColor('#9ca3af').fontSize(7).text('No image', imageBox.x, imageBox.y + 10, { width: imageBox.w, align: 'center' });
                    }
                } else {
                    doc.fillColor('#9ca3af').fontSize(7).text('No image', imageBox.x, imageBox.y + 10, { width: imageBox.w, align: 'center' });
                }

                // Description
                doc.fillColor('#1f2937').font('Helvetica').fontSize(9).text(itemName, descX + 6, y + 10, { width: cols[2].width - 12, align: 'left' });
                if (itemSize) {
                    const sizeY = y + 12 + descHeight;
                    doc.fillColor('#6b7280').fontSize(8).text(itemSize, descX + 6, sizeY, { width: cols[2].width - 12, align: 'left' });
                }

                // Tax
                const taxX = descX + cols[2].width;
                doc.fillColor('#334155').font('Helvetica').fontSize(9).text('18%', taxX, y + Math.max(18, (rowH / 2) - 4), { width: cols[3].width, align: 'center' });

                // Qty
                const qtyX = taxX + cols[3].width;
                doc.text(String(lineQty), qtyX, y + Math.max(18, (rowH / 2) - 4), { width: cols[4].width, align: 'center' });

                // Unit price
                const unitX = qtyX + cols[4].width;
                doc.text(`${linePrice.toLocaleString()} RWF`, unitX, y + Math.max(18, (rowH / 2) - 4), { width: cols[5].width - 6, align: 'right' });

                // Total
                const totalX = unitX + cols[5].width;
                doc.font('Helvetica-Bold').text(`${lineTotal.toLocaleString()} RWF`, totalX, y + Math.max(18, (rowH / 2) - 4), { width: cols[6].width - 8, align: 'right' });

                y += rowH;
                doc.y = y;
            });

            // Totals area as right-aligned table.
            const totalsTop = y + 8;
            const totalsW = 250;
            const totalsX = right - totalsW;
            const totalsRowH = 20;
            const totals = [
                { label: 'Sub Total:', value: `${subTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: 'Tax (18%):', value: `${taxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: 'Transport:', value: `${transport.toLocaleString()}` },
                { label: 'Total:', value: `${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, bold: true }
            ];

            doc.rect(totalsX, totalsTop, totalsW, totalsRowH * totals.length).lineWidth(0.8).strokeColor('#d9deea').stroke();
            totals.forEach((row, i) => {
                const ry = totalsTop + (i * totalsRowH);
                if (row.bold) {
                    doc.save();
                    doc.rect(totalsX, ry, totalsW, totalsRowH).fill('#eef4ff');
                    doc.restore();
                }
                if (i > 0) {
                    doc.moveTo(totalsX, ry).lineTo(totalsX + totalsW, ry).lineWidth(0.7).strokeColor('#e5e9f2').stroke();
                }
                doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(row.bold ? 10 : 9).fillColor('#1f2937')
                    .text(row.label, totalsX + 10, ry + 6, { width: 120, align: 'left' })
                    .text(`${row.value} RWF`, totalsX + 120, ry + 6, { width: totalsW - 130, align: 'right' });
            });

            y = totalsTop + totalsRowH * totals.length + 16;
            doc.y = y;

            doc.fontSize(9).font('Helvetica').fillColor('#374151');
            doc.text(`Payment Status: ${getReceiptPaymentStatusLabel(order)}`, left, y);
            doc.text(`Order Status: ${order.status || ''}`, left, y + 13);

            paymentOptionsPromise.then((paymentOptions) => {
                if (paymentOptions?.tin_number) {
                    doc.text(`TIN / VAT: ${paymentOptions.tin_number}`, left, y + 26);
                }
                if (paymentOptions?.ebm_number) {
                    doc.text(`EBM: ${paymentOptions.ebm_number}`, left, y + 39);
                }

                const footerY = doc.page.height - doc.page.margins.bottom - 24;
                doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f2d75')
                    .text('Thank you for your order.', left, footerY, { width: tableWidth, align: 'center' });

                doc.end();
            });

            stream.on('finish', () => resolve(`/uploads/receipts/${filename}`));
            stream.on('error', err => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

// ── helpers shared by both order emails ──────────────────────────────────────
function buildItemsTableHtml(order) {
    return (order.items || []).map((item, idx) => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${idx + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name || item.product_name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${(item.price || 0).toLocaleString()} RWF</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${((item.price || 0) * (item.quantity || 1)).toLocaleString()} RWF</td>
        </tr>
    `).join('');
}

function buildItemsTableHeaders() {
    return `
        <tr style="background-color: #f8f9fa;">
            <th style="padding: 12px 8px; text-align: left; font-size: 14px; color: #666666;">#</th>
            <th style="padding: 12px 8px; text-align: left; font-size: 14px; color: #666666;">Product</th>
            <th style="padding: 12px 8px; text-align: center; font-size: 14px; color: #666666;">Qty</th>
            <th style="padding: 12px 8px; text-align: right; font-size: 14px; color: #666666;">Price</th>
            <th style="padding: 12px 8px; text-align: right; font-size: 14px; color: #666666;">Total</th>
        </tr>
    `;
}

function resolveAttachments(order, receiptPath) {
    const attachments = [];
    if (receiptPath) {
        const abs = path.join(__dirname, '..', receiptPath.replace(/^\//, ''));
        if (fs.existsSync(abs)) {
            attachments.push({ filename: `Order-Receipt-${order.id}.pdf`, path: abs, contentType: 'application/pdf' });
        }
    }
    return attachments;
}

// ── 1. Email to ADMIN: "New Order Received" alert ────────────────────────────
async function sendAdminNewOrderEmail(order, receiptPath) {
    const adminEmail = getAdminNotificationEmail();
    const itemsList = buildItemsTableHtml(order);
    const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
            <tr>
              <td style="background:linear-gradient(135deg,#e53e3e 0%,#c0392b 100%);padding:28px 30px;text-align:center;">
                <h1 style="margin:0;color:#fff;font-size:26px;font-weight:bold;">AVATA TRADING</h1>
                <p style="margin:8px 0 0;color:#ffe0e0;font-size:15px;">Admin Notification System</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 30px;">
                <p style="margin:0 0 20px;color:#333;font-size:16px;">Hello Admin,</p>
                <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">A new customer order has been received in the AVATA Trading system.</p>

                <!-- Customer Info -->
                <h3 style="margin:0 0 10px;color:#333;font-size:16px;">Customer Information</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;padding:0;margin-bottom:24px;">
                  <tr><td style="padding:14px 18px;">
                    <p style="margin:0 0 6px;font-size:14px;color:#555;">Customer Name: <strong>${order.customer_name || 'Not provided'}</strong></p>
                    <p style="margin:0 0 6px;font-size:14px;color:#555;">Email: <strong>${order.customer_email || 'Not provided'}</strong></p>
                    <p style="margin:0;font-size:14px;color:#555;">Phone: <strong>${order.customer_phone || 'Not provided'}</strong></p>
                    <p style="margin:0;font-size:14px;color:#555;">Delivery Location: <strong>${order.delivery_address || 'N/A'}</strong></p>
                  </td></tr>
                </table>

                <!-- Order Details -->
                <h3 style="margin:0 0 10px;color:#333;font-size:16px;">Order Details</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;padding:0;margin-bottom:24px;">
                  <tr><td style="padding:14px 18px;">
                    <p style="margin:0 0 6px;font-size:14px;color:#555;">Order ID: <strong>#${order.id}</strong></p>
                    <p style="margin:0 0 6px;font-size:14px;color:#555;">Date: <strong>${orderDate}</strong></p>
                    <p style="margin:0;font-size:14px;color:#555;">Status: <strong style="color:#e53e3e;">Order Sent</strong></p>
                  </td></tr>
                </table>

                <!-- Items Table -->
                <h3 style="margin:0 0 12px;color:#333;font-size:16px;">Ordered Items</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                  <thead>${buildItemsTableHeaders()}</thead>
                  <tbody>${itemsList}</tbody>
                  <tfoot>
                    <tr>
                      <td colspan="4" style="padding:14px 8px;text-align:right;font-weight:bold;font-size:16px;color:#333;">Total Amount:</td>
                      <td style="padding:14px 8px;text-align:right;font-weight:bold;font-size:16px;color:#e53e3e;">${(order.total_amount || 0).toLocaleString()} RWF</td>
                    </tr>
                  </tfoot>
                </table>

                <!-- Action Required -->
                <div style="background:#fff8e1;border-left:4px solid #f59e0b;padding:16px 18px;border-radius:4px;margin-bottom:20px;">
                  <p style="margin:0 0 10px;font-size:14px;color:#333;">⚠️ <strong>Admin Action Required</strong></p>
                  <p style="margin:0 0 8px;font-size:14px;color:#555;">Please review the order and:</p>
                  <ul style="margin:0;padding-left:20px;font-size:14px;color:#555;line-height:1.8;">
                    <li>Verify product availability</li>
                    <li>Confirm payment details</li>
                    <li>Contact the customer if necessary</li>
                    <li>Update the order status in the system</li>
                  </ul>
                </div>

                <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
                  💡 You can reply directly to this email to contact <strong>${order.customer_email || 'the customer'}</strong>. Their email is set as the reply-to address.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8f9fa;padding:18px 30px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0 0 4px;color:#333;font-size:13px;font-weight:bold;">AVATA Trading System</p>
                <p style="margin:0;color:#999;font-size:12px;">© 2026 AVATA Trading. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body></html>
    `;

    const text = `Hello Admin,\n\nA new customer order has been received in the AVATA Trading system.\n\nCustomer Information\nCustomer Name: ${order.customer_name || 'N/A'}\nEmail: ${order.customer_email || 'N/A'}\nPhone: ${order.customer_phone || 'N/A'}\nLocation: ${order.delivery_address || 'N/A'}\n\nOrder Details\nOrder ID: #${order.id}\nDate: ${orderDate}\nStatus: Order Sent\n\nTotal Amount: ${(order.total_amount || 0).toLocaleString()} RWF\n\nAdmin Action Required\nPlease review the order and:\n- Verify product availability\n- Confirm payment details\n- Contact the customer if necessary\n- Update the order status in the system\n\nLogin to the Admin Dashboard to manage this order.\n\nAVATA Trading System\n© 2026 AVATA Trading`;

    const sentCount = await sendBrevoEmailToRecipients({
        recipients: [adminEmail],
        subject: `🆕 New Order Received #${order.id} from ${order.customer_name || 'Customer'} — AVATA Trading`,
        text,
        html,
        replyTo: isValidEmail(order?.customer_email)
            ? { email: order.customer_email.trim(), name: order.customer_name || 'Customer' }
            : undefined,
        attachments: resolveAttachments(order, receiptPath)
    });
    console.log(`✓ Admin new-order email sent (order #${order.id}) → ${adminEmail}`);
    return sentCount > 0;
}

// ── 2. Email to CUSTOMER: "Order Sent" ───────────────────────────────────────
async function sendCustomerOrderConfirmationEmail(order, receiptPath) {
    if (!isValidEmail(order?.customer_email)) return false;
    const itemsList = buildItemsTableHtml(order);
    const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
    <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
            <tr>
              <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;text-align:center;">
                <h1 style="margin:0;color:#fff;font-size:28px;font-weight:bold;">AVATA TRADING</h1>
                <p style="margin:10px 0 0;color:#fff;font-size:15px;">Your Trusted PPE and Safety Equipment Provider</p>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 30px;">
                <p style="margin:0 0 20px;color:#555;font-size:16px;line-height:1.6;">Hello <strong>${order.customer_name || 'Customer'}</strong>,</p>
                <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">Thank you for shopping with AVATA Trading.</p>

                <h2 style="margin:0 0 20px;color:#333;font-size:21px;">📦 Order Sent Successfully</h2>
                <p style="margin:0 0 25px;color:#555;font-size:15px;line-height:1.6;">
                  Your order has been successfully sent to our system and is now waiting for review by our team.
                  Please remember to complete your payment — our team will contact you via your dashboard on the system.
                </p>

                <!-- Order Details -->
                <h3 style="margin:0 0 10px;color:#333;font-size:16px;">Order Details</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;padding:0;margin-bottom:24px;">
                  <tr><td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:14px;color:#666;">Order ID: <strong style="color:#333;">#${order.id}</strong></p>
                    <p style="margin:0 0 8px;font-size:14px;color:#666;">Date: <strong style="color:#333;">${orderDate}</strong></p>
                    <p style="margin:0;font-size:14px;color:#666;">Status: <strong style="color:#667eea;">Order Sent</strong></p>
                    <p style="margin:6px 0 0;font-size:14px;color:#666;">Delivery Location: <strong>${order.delivery_address || 'Not provided'}</strong></p>
                  </td></tr>
                </table>

                <!-- Items -->
                <h3 style="margin:0 0 12px;color:#333;font-size:16px;">Your Items</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;margin-bottom:24px;">
                  <thead>${buildItemsTableHeaders()}</thead>
                  <tbody>${itemsList}</tbody>
                  <tfoot>
                    <tr>
                      <td colspan="4" style="padding:14px 8px;text-align:right;font-weight:bold;font-size:16px;color:#333;">Total Amount:</td>
                      <td style="padding:14px 8px;text-align:right;font-weight:bold;font-size:16px;color:#667eea;">${(order.total_amount || 0).toLocaleString()} RWF</td>
                    </tr>
                  </tfoot>
                </table>

                <div style="background:#e8f4fd;border-left:4px solid #667eea;padding:14px 18px;border-radius:4px;margin-bottom:20px;">
                  <p style="margin:0 0 6px;font-size:14px;color:#333;line-height:1.6;"><strong>📌 What happens next?</strong></p>
                  <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Our team will review your order and contact you shortly to confirm payment and delivery details.</p>
                </div>

                <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">
                  If you have any questions, please contact us and mention your Order Number <strong>#${order.id}</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8f9fa;padding:20px 30px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0 0 4px;color:#333;font-size:14px;font-weight:bold;">AVATA Trading</p>
                <p style="margin:0 0 6px;color:#666;font-size:13px;">Your Trusted PPE and Safety Equipment Provider</p>
                <p style="margin:0;color:#999;font-size:12px;">© 2026 AVATA Trading. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body></html>
    `;

    const text = `Hello ${order.customer_name || 'Customer'},\n\nThank you for shopping with AVATA Trading.\n\n📦 Order Sent Successfully\n\nYour order has been successfully sent to our system and is now waiting for review by our team. Please remember to complete your payment — our team will contact you via your dashboard on the system.\n\nOrder Details\nOrder ID: #${order.id}\nDate: ${orderDate}\nStatus: Order Sent\nDelivery Location: ${order.delivery_address || 'N/A'}\n\nTotal Amount: ${(order.total_amount || 0).toLocaleString()} RWF\n\nWhat happens next?\nOur team will review your order and contact you shortly to confirm payment and delivery details.\n\nIf you have any questions, please contact us and mention your Order Number #${order.id}.\n\nThank you for choosing AVATA Trading.\n\nAVATA Trading\nYour Trusted PPE and Safety Equipment Provider\n© 2026 AVATA Trading. All rights reserved.`;

    const sentCount = await sendBrevoEmailToRecipients({
        recipients: [order.customer_email.trim()],
        subject: `📦 Your Order #${order.id} Has Been Sent — AVATA Trading`,
        text,
        html,
        attachments: resolveAttachments(order, receiptPath)
    });
    console.log(`✓ Customer order-sent email sent (order #${order.id}) → ${order.customer_email}`);
    return sentCount > 0;
}

// ── Combined: sends both admin alert + customer confirmation ──────────────────
async function sendOrderEmail(order, receiptPath) {
    try {
        if (!process.env.BREVO_API_KEY) {
            console.warn('BREVO_API_KEY missing — skipping order emails');
            return false;
        }

        let ok = false;

        // Always notify the business owner
        try {
            const adminSent = await sendAdminNewOrderEmail(order, receiptPath);
            if (adminSent) ok = true;
        } catch (e) {
            console.error('Error sending admin new-order email:', e);
        }

        // Send confirmation to customer if they have a valid email
        if (isValidEmail(order?.customer_email)) {
            try {
                const customerSent = await sendCustomerOrderConfirmationEmail(order, receiptPath);
                if (customerSent) ok = true;
            } catch (e) {
                console.error('Error sending customer confirmation email:', e);
            }
        }

        return ok;
    } catch (err) {
        console.error('Error in sendOrderEmail:', err);
        return false;
    }
}

async function sendPaymentStageEmail(order, stageLabel, proofRef = '') {
    try {
        if (!process.env.BREVO_API_KEY) {
            console.warn('BREVO_API_KEY missing — skipping payment-stage email');
            return false;
        }

        const { email: fromEmail, name: fromName } = getSenderDetails();
        const recipients = getStatusUpdateRecipients(order);
        if (recipients.length === 0) return false;

        const html = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
                <h2 style="margin: 0 0 10px;">Payment Stage Update</h2>
                <p><strong>Stage:</strong> ${stageLabel}</p>
                <p><strong>Order ID:</strong> #${order.id}</p>
                <p><strong>Customer:</strong> ${order.customer_name || 'Guest'}</p>
                <p><strong>Email:</strong> ${order.customer_email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${order.customer_phone || 'N/A'}</p>
                <p><strong>Total:</strong> ${(Number(order.total_amount || 0)).toLocaleString()} RWF</p>
                ${proofRef ? `<p><strong>Payment Proof:</strong> ${proofRef}</p>` : ''}
                <p style="margin-top: 14px;">This message was generated by AVATA order workflow.</p>
            </div>
        `;

        const sentCount = await sendBrevoEmailToRecipients({
            recipients,
            subject: `Payment Update: ${stageLabel} - Order #${order.id}`,
            text: `Payment stage update\nStage: ${stageLabel}\nOrder: #${order.id}\nCustomer: ${order.customer_name || 'Guest'}\nEmail: ${order.customer_email || 'N/A'}\nTotal: ${(Number(order.total_amount || 0)).toLocaleString()} RWF\nPayment Proof: ${proofRef || 'N/A'}`,
            html,
            replyTo: isValidEmail(order?.customer_email)
                ? { email: order.customer_email.trim(), name: order.customer_name || 'Customer' }
                : undefined
        });
        return sentCount > 0;
    } catch (error) {
        console.error('Error sending payment-stage email:', error);
        return false;
    }
}

async function sendOrderStatusEmail(order, statusLabel) {
    try {
        if (!process.env.BREVO_API_KEY) return false;

        const recipients = getStatusUpdateRecipients(order);
        if (recipients.length === 0) return false;

        const { email: fromEmail, name: fromName } = getSenderDetails();
        const safeStatus = String(statusLabel || order?.status || 'Updated');

        const html = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
                <h2 style="margin: 0 0 10px;">Order Status Update</h2>
                <p><strong>Order ID:</strong> #${order.id}</p>
                <p><strong>Customer:</strong> ${order.customer_name || 'Guest'}</p>
                <p><strong>Status:</strong> ${safeStatus}</p>
                <p><strong>Payment Status:</strong> ${order.payment_status || 'N/A'}</p>
                <p><strong>Total:</strong> ${(Number(order.total_amount || 0)).toLocaleString()} RWF</p>
                <p style="margin-top: 14px;">Thank you for choosing AVATA Trading.</p>
            </div>
        `;

        const text = `Order Status Update\nOrder: #${order.id}\nCustomer: ${order.customer_name || 'Guest'}\nStatus: ${safeStatus}\nPayment Status: ${order.payment_status || 'N/A'}\nTotal: ${(Number(order.total_amount || 0)).toLocaleString()} RWF`;

        const sentCount = await sendBrevoEmailToRecipients({
            recipients,
            subject: `Order Update: ${safeStatus} - #${order.id}`,
            text,
            html,
            replyTo: isValidEmail(order?.customer_email)
                ? { email: order.customer_email.trim(), name: order.customer_name || 'Customer' }
                : undefined
        });

        return sentCount > 0;
    } catch (error) {
        console.error('Error sending order status email:', error);
        return false;
    }
}

// Create a new order
exports.createOrder = async (req, res) => {
    let connection;
    let offerStockSnapshot = null;
    try {
        const { items, customer_name, customer_email, customer_phone, status, order_source, delivery_address } = req.body;
        
        // Validate required fields
        const trimmedAddress = String(delivery_address || '').trim();
        if (!trimmedAddress) {
            return res.status(400).json({ success: false, message: 'Delivery address is required.' });
        }
        
        const paymentOptions = await PaymentOption.getCurrent().catch(() => ({ reference_prefix: 'PAY' }));
        const referencePrefix = String(paymentOptions?.reference_prefix || 'PAY').trim().toUpperCase() || 'PAY';
        const paymentNumber = `${referencePrefix}-${Date.now()}`;
        const normalizedItems = normalizeOrderItems(items);
        if (normalizedItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Order must include valid products and quantities.' });
        }

        let userId = req.user?.id || null;
        try {
            const auth = req.headers.authorization;
            if (!userId && auth && auth.startsWith('Bearer ')) {
                const token = auth.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                if (decoded && decoded.id) userId = decoded.id;
            }
        } catch (err) { /* ignore */ }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const stockReservation = await validateAndReserveStock(connection, normalizedItems);
        if (!stockReservation.ok) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: 'Some products are out of stock or have insufficient stock. Please update your cart and try again.',
                details: stockReservation.failures
            });
        }

        offerStockSnapshot = stockReservation.offerStockSnapshot || null;

        const computedTotalAmount = Number(stockReservation.totalAmount || 0);

        const orderId = await Order.createWithConnection({
            user_id: userId || null,
            total_amount: computedTotalAmount,
            status: status || 'Waiting_Proof',
            order_source: order_source || 'website',
            customer_name,
            customer_email,
            customer_phone,
            payment_number: paymentNumber,
            items: stockReservation.reservedItems,
            delivery_address: trimmedAddress
        }, connection);

        await connection.commit();
        connection.release();
        connection = null;

        // Create notification for owner/admin
        try {
            const notifId = await Notification.create({
                user_id: null, // null for systems/admin
                message: `New Order #${orderId} from ${customer_name || 'Guest'} for ${computedTotalAmount.toLocaleString()} RWF${delivery_address ? ' — ' + delivery_address : ''}`,
                type: 'order',
                link: `/orders/${orderId}`
            });
            console.log(`✓ Order notification created: ID ${notifId}`);
        } catch (nErr) { console.error('❌ Failed to create order notification:', nErr); }

        const order = await Order.findById(orderId);

        let emailSent = null;
        if (order?.order_source === 'email') {
            try {
                const receiptUrl = await generateReceiptPdf(order);
                await Order.update(orderId, { payment_receipt: receiptUrl });
                const updated = await Order.findById(orderId);
                if (shouldSendEmailsForOrder(updated)) {
                    emailSent = await sendOrderEmail(updated, receiptUrl);
                }
            } catch (syncEmailError) {
                console.error('Receipt/email sync error:', syncEmailError);
                // If receipt generation fails, still try to send the order email without attachment.
                if (shouldSendEmailsForOrder(order)) {
                    emailSent = await sendOrderEmail(order, null);
                } else {
                    emailSent = false;
                }
            }
        } else {
            // generate receipt and email (best-effort, do not block response)
            (async () => {
                try {
                    const receiptUrl = await generateReceiptPdf(order);
                    await Order.update(orderId, { payment_receipt: receiptUrl });
                    const updated = await Order.findById(orderId);
                    if (shouldSendEmailsForOrder(updated)) {
                        await sendOrderEmail(updated, receiptUrl);
                    }
                } catch (e) {
                    console.error('Receipt/email async error:', e);
                }
            })();
        }

        const currentPaymentOptions = await PaymentOption.getCurrent().catch(() => null);
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order,
            emailSent,
            paymentOptions: currentPaymentOptions
        });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
            connection.release();
        }
        try {
            restoreSpecialOfferStock(offerStockSnapshot);
        } catch (restoreError) {
            console.error('Failed to restore special offer stock after order failure:', restoreError);
        }
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, message: 'Error creating order' });
    }
};

// Serve receipt file (protected)
exports.getReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const isAdminOrOwner = req.user?.role === 'admin' || req.user?.role === 'owner';
        const isOrderOwner = order.user_id === req.user?.id || order.customer_email === req.user?.email;
        if (!isAdminOrOwner && !isOrderOwner) return res.status(403).json({ success: false, message: 'Access denied' });

        // Match frontend behavior: customers can access receipt after delivery once payment is approved.
        if (!isAdminOrOwner) {
            if (!isReceiptEligible(order)) {
                return res.status(403).json({ success: false, message: 'Receipt available after payment approval and delivery' });
            }
        }

        let receiptPath = isReceiptPdfPath(order.payment_receipt) ? order.payment_receipt : null;
        let abs = receiptPath ? resolveReceiptAbsolutePath(receiptPath) : null;

        // Keep receipt status text up to date (e.g., Pending -> Paid after approval).
        if (isReceiptEligible(order)) {
            receiptPath = await checkAndGenerateReceipt(id, { force: true });
            abs = receiptPath ? resolveReceiptAbsolutePath(receiptPath) : null;
        }

        if (!receiptPath || !abs || !fs.existsSync(abs)) {
            receiptPath = await checkAndGenerateReceipt(id);
            abs = receiptPath ? resolveReceiptAbsolutePath(receiptPath) : null;
        }

        if (!receiptPath || !abs || !fs.existsSync(abs)) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        res.sendFile(abs);
    } catch (err) {
        console.error('Error serving receipt:', err);
        res.status(500).json({ success: false, message: 'Error serving receipt' });
    }
};

// Admin only: update receipt details and regenerate PDF at any time.
exports.updateReceiptSettings = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        if (req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only admin can edit receipt settings' });
        }

        const transportAmount = sanitizeTransportAmount(req.body?.transport_amount);
        await Order.update(id, {
            receipt_transport: transportAmount,
            receipt_updated_at: new Date(),
            receipt_updated_by: req.user?.id || null
        });

        const refreshedOrder = await Order.findById(id);
        const receiptPath = await generateReceiptPdf(refreshedOrder);
        await Order.update(id, { payment_receipt: receiptPath });
        const updated = await Order.findById(id);

        res.json({
            success: true,
            message: 'Receipt updated by admin successfully',
            receipt: {
                path: receiptPath,
                transport_amount: transportAmount,
                updated_at: updated.receipt_updated_at,
                updated_by: updated.receipt_updated_by
            },
            order: updated
        });
    } catch (error) {
        console.error('Error updating receipt settings:', error);
        res.status(500).json({ success: false, message: 'Error updating receipt settings' });
    }
};

// Get all orders (owner/admin only)
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.findAll();
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, message: 'Error fetching orders' });
    }
};

// Get user's orders
exports.getUserOrders = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const email = req.user?.email || req.query.email || null;
        const orders = await Order.findByUserIdentifier({ userId, email });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ success: false, message: 'Error fetching orders' });
    }
};

// Update order status (owner/admin only)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await Order.updateStatus(id, status);
        
        // Auto-generate receipt if status is Delivered/Shipped/Completed and payment is verified
        if (['Delivered', 'delivered', 'Shipped', 'shipped', 'Completed', 'completed'].includes(status)) {
            await checkAndGenerateReceipt(id);
        }
        
        const order = await Order.findById(id);
        if (shouldSendEmailsForOrder(order)) {
            sendOrderStatusEmail(order, status).catch(() => {});
        }
        res.json({ success: true, message: 'Order status updated', order });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Error updating order' });
    }
};

// Approve payment (owner/admin only)
exports.verifyPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_receipt } = req.body;
        const order = await Order.findById(id);

        if (!order) {
            console.log(`❌ Order ${id} not found`);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const statusLower = String(order.status || '').toLowerCase();

        console.log(`📋 Order ${id} verification attempt:`, {
            payment_proof: order.payment_proof,
            payment_proof_file: order.payment_proof_file,
            payment_receipt: payment_receipt,
            current_status: order.status,
            verification_status: order.verification_status
        });

        // Second Approve action in 4-button flow: Paid -> Processing
        if (statusLower === 'paid') {
            await Order.updateStatus(id, 'Processing');
            const progressedOrder = await Order.findById(id);
            if (shouldSendEmailsForOrder(progressedOrder)) {
                sendOrderStatusEmail(progressedOrder, 'Processing').catch(() => {});
            }
            return res.json({
                success: true,
                message: 'Order approved for processing (Paid -> Processing).',
                order: progressedOrder
            });
        }

        if (statusLower === 'processing' || statusLower === 'shipped' || statusLower === 'delivered' || statusLower === 'completed' || statusLower === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: `Approve action is not allowed when order status is ${order.status}.`
            });
        }

        // ADMIN SYSTEM RULE: Cannot approve payment without uploaded proof
        if (!order.payment_proof && !order.payment_proof_file && !payment_receipt) {
            console.log(`❌ No payment proof for order ${id}`);
            return res.status(400).json({ success: false, message: 'System Rule: Cannot approve payment without uploaded proof.' });
        }

        // Verification status must be "pending" (or empty for old orders)
        if (order.verification_status && order.verification_status !== 'pending' && order.verification_status !== 'rejected') {
            console.log(`❌ Invalid verification status for order ${id}: ${order.verification_status}`);
            return res.status(400).json({ success: false, message: 'System Rule: Payment verification status is not pending.' });
        }

        const adminId = req.user?.id || null;
        console.log(`✅ Approving payment for order ${id} by admin ${adminId}`);
        
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await Order.update(id, {
            verification_status: 'approved',
            payment_status: 'Paid',
            status: 'Paid',
            verified_by: adminId,
            verified_at: now
        });

        const updatedOrder = await Order.findById(id);
        console.log(`✅ Order ${id} payment approved successfully`);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendOrderStatusEmail(updatedOrder, 'Paid').catch(() => {});
        }
        
        // Auto-generate receipt if order is already delivered
        await checkAndGenerateReceipt(id);
        
        res.json({ success: true, message: 'Payment approved successfully', order: updatedOrder });
    } catch (error) {
        console.error('❌ Error verifying payment:', error);
        res.status(500).json({ success: false, message: 'Error verifying payment', error: error.message });
    }
};

// Reject payment (owner/admin only)
exports.rejectPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        await Order.update(id, {
            verification_status: 'rejected',
            status: 'Waiting_Proof',
            payment_proof: null,
            payment_proof_file: null,
            payment_status: 'pending'
        });

        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendOrderStatusEmail(updatedOrder, 'Payment Rejected').catch(() => {});
        }
        res.json({ success: true, message: 'Payment rejected. Customer must upload new proof.', order: updatedOrder });
    } catch (error) {
        console.error('Error rejecting payment:', error);
        res.status(500).json({ success: false, message: 'Error rejecting payment' });
    }
};

// Mark as shipped (owner/admin only)
exports.markAsShipped = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // ADMIN SYSTEM RULE: Cannot ship unpaid orders.
        if (order.status !== 'Paid' && order.payment_status !== 'Paid') {
            return res.status(400).json({ success: false, message: 'System Rule: Cannot ship unpaid orders.' });
        }

        await Order.updateStatus(id, 'Shipped');
        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendOrderStatusEmail(updatedOrder, 'Shipped').catch(() => {});
        }
        
        // Auto-generate receipt if payment is already verified
        await checkAndGenerateReceipt(id);
        
        res.json({ success: true, message: 'Order marked as shipped', order: updatedOrder });
    } catch (error) {
        console.error('Error marking as shipped:', error);
        res.status(500).json({ success: false, message: 'Error updating order' });
    }
};

// Mark as delivered (owner/admin only) - This triggers customer confirmation
exports.markAsDelivered = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // ADMIN SYSTEM RULE: Can only deliver paid/verified orders.
        const isPaid = isOrderFullyPaid(order);
        if (!isPaid) {
            return res.status(400).json({ success: false, message: 'System Rule: Cannot deliver unpaid orders.' });
        }

        const currentStatus = String(order.status || '').toLowerCase();
        if (['completed', 'cancelled', 'not_delivered'].includes(currentStatus)) {
            return res.status(400).json({ success: false, message: `System Rule: Cannot deliver an order that is already ${order.status}.` });
        }

        // Deliver action in 4-button flow: Paid -> Processing -> Shipped -> Delivered
        if (currentStatus === 'paid') {
            await Order.updateStatus(id, 'Processing');
            const movedOrder = await Order.findById(id);
            if (shouldSendEmailsForOrder(movedOrder)) {
                sendOrderStatusEmail(movedOrder, 'Processing').catch(() => {});
            }
            return res.json({ success: true, message: 'Order moved from Paid to Processing.', order: movedOrder });
        }

        if (currentStatus === 'processing') {
            await Order.updateStatus(id, 'Shipped');
            const movedOrder = await Order.findById(id);
            if (shouldSendEmailsForOrder(movedOrder)) {
                sendOrderStatusEmail(movedOrder, 'Shipped').catch(() => {});
            }
            return res.json({ success: true, message: 'Order moved from Processing to Shipped.', order: movedOrder });
        }

        if (currentStatus !== 'shipped') {
            return res.status(400).json({
                success: false,
                message: 'Deliver action is only allowed for Paid, Processing or Shipped orders.'
            });
        }

        await Order.updateStatus(id, 'Delivered');
        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendOrderStatusEmail(updatedOrder, 'Delivered').catch(() => {});
        }
        
        // Auto-generate receipt if payment is already verified
        await checkAndGenerateReceipt(id);
        
        res.json({ success: true, message: 'Order marked as delivered', order: updatedOrder });
    } catch (error) {
        console.error('Error marking as delivered:', error);
        res.status(500).json({ success: false, message: 'Error updating order' });
    }
};

// Confirm delivery (Customer action)
exports.confirmDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { confirmed } = req.body; // boolean

        if (!confirmed) {
            return res.status(400).json({
                success: false,
                message: 'Only "Yes Delivered" confirmation is supported in this workflow.'
            });
        }

        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const currentStatus = String(order.status || '').toLowerCase();
        if (currentStatus !== 'delivered') {
            return res.status(400).json({
                success: false,
                message: 'Delivery confirmation is only allowed when status is Delivered.'
            });
        }

        const status = 'Completed';
        await Order.updateStatus(id, status);

        // Auto-generate receipt if delivery confirmed and payment is already verified
        await checkAndGenerateReceipt(id);

        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendOrderStatusEmail(updatedOrder, status).catch(() => {});
        }
        res.json({ success: true, message: 'Delivery confirmed successfully.', order: updatedOrder });
    } catch (error) {
        console.error('Error confirming delivery:', error);
        res.status(500).json({ success: false, message: 'Error confirming delivery' });
    }
};

// Customer submits payment proof URL
exports.submitPaymentProof = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_proof } = req.body;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const isAdminOrOwner = req.user?.role === 'admin' || req.user?.role === 'owner';
        const isOrderOwner = order.user_id === req.user?.id || String(order.customer_email || '').toLowerCase() === String(req.user?.email || '').toLowerCase();
        if (!isAdminOrOwner && !isOrderOwner) {
            return res.status(403).json({ success: false, message: 'Access denied for this order' });
        }

        await Order.update(id, {
            payment_proof,
            payment_status: 'awaiting_verification',
            status: 'Payment_Under_Review',
            verification_status: 'pending'
        });
        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendPaymentStageEmail(updatedOrder, 'Payment Proof Submitted', payment_proof).catch(() => {});
        }
        res.json({ success: true, message: 'Payment proof submitted successfully', order: updatedOrder });
    } catch (error) {
        console.error('Error submitting payment proof:', error);
        res.status(500).json({ success: false, message: 'Error submitting payment proof' });
    }
};

// Customer uploads payment proof file
exports.submitPaymentProofFile = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const isAdminOrOwner = req.user?.role === 'admin' || req.user?.role === 'owner';
        const isOrderOwner = order.user_id === req.user?.id || String(order.customer_email || '').toLowerCase() === String(req.user?.email || '').toLowerCase();
        if (!isAdminOrOwner && !isOrderOwner) {
            return res.status(403).json({ success: false, message: 'Access denied for this order' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const filePath = `/uploads/payment_proofs/${req.file.filename}`;
        await Order.update(id, {
            payment_proof_file: filePath,
            payment_proof: filePath, // also set url field for backward-compat
            payment_status: 'awaiting_verification',
            status: 'Payment_Under_Review',
            verification_status: 'pending'
        });
        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendPaymentStageEmail(updatedOrder, 'Payment Proof Uploaded', filePath).catch(() => {});
        }
        res.json({ success: true, message: 'Payment proof uploaded successfully', order: updatedOrder, filePath });
    } catch (error) {
        console.error('Error uploading payment proof:', error);
        res.status(500).json({ success: false, message: 'Error uploading payment proof' });
    }
};

// Customer removes payment proof to upload a new one
exports.removePaymentProof = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const isAdminOrOwner = req.user?.role === 'admin' || req.user?.role === 'owner';
        const isOrderOwner = order.user_id === req.user?.id || String(order.customer_email || '').toLowerCase() === String(req.user?.email || '').toLowerCase();
        if (!isAdminOrOwner && !isOrderOwner) {
            return res.status(403).json({ success: false, message: 'Access denied for this order' });
        }

        const isLocked = order.status === 'Paid'
            || order.status === 'Delivered'
            || order.status === 'Completed'
            || order.status === 'Cancelled'
            || order.status === 'Not_Delivered'
            || order.payment_status === 'Paid'
            || order.payment_status === 'verified'
            || order.verification_status === 'approved';

        if (isLocked) {
            return res.status(400).json({ success: false, message: 'Payment proof cannot be removed at this stage.' });
        }

        if (order.payment_proof_file && order.payment_proof_file.startsWith('/uploads/payment_proofs/')) {
            const abs = path.join(__dirname, '..', order.payment_proof_file.replace(/^\//, ''));
            try {
                if (fs.existsSync(abs)) fs.unlinkSync(abs);
            } catch (fileError) {
                console.warn('Failed to delete payment proof file:', fileError.message);
            }
        }

        await Order.update(id, {
            payment_proof: null,
            payment_proof_file: null,
            payment_status: 'pending',
            verification_status: null,
            status: 'Waiting_Proof'
        });

        const updatedOrder = await Order.findById(id);
        res.json({ success: true, message: 'Payment proof removed successfully', order: updatedOrder });
    } catch (error) {
        console.error('Error removing payment proof:', error);
        res.status(500).json({ success: false, message: 'Error removing payment proof' });
    }
};

// Get order comments
exports.getOrderComments = async (req, res) => {
    try {
        const { id } = req.params;
        // Verify user owns order or is admin/owner
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const isAdminOrOwner = req.user?.role === 'admin' || req.user?.role === 'owner';
        const isOrderOwner = order.user_id === req.user?.id;
        if (!isAdminOrOwner && !isOrderOwner) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        const comments = await Order.getComments(id);
        res.json({ success: true, comments });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ success: false, message: 'Error fetching comments' });
    }
};

// Add order comment (admin/owner can always; customer on their own order)
exports.addOrderComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        if (!comment || !comment.trim()) {
            return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
        }
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const isAdminOrOwner = req.user?.role === 'admin' || req.user?.role === 'owner';
        const isOrderOwner = order.user_id === req.user?.id;
        if (!isAdminOrOwner && !isOrderOwner) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        const commentId = await Order.addComment(id, req.user.id, comment.trim());
        const comments = await Order.getComments(id);

        const commentText = comment.trim();
        const adminName = req.user?.full_name || 'Admin';
        const customerName = order.customer_name || req.user?.full_name || 'Customer';

        // If ADMIN added comment → notify CUSTOMER
        if (isAdminOrOwner && !isOrderOwner) {
            try {
                const notifId = await Notification.create({
                    user_id: order.user_id,
                    message: `Admin replied to order #${id}: "${commentText.substring(0, 50)}..."`,
                    type: 'comment',
                    link: `/my-account?replyOrder=${id}`
                });
                console.log(`✓ Admin reply notification created for customer ${order.user_id}: ID ${notifId}`);
            } catch (nErr) {
                console.error('❌ Failed to create customer notification:', nErr);
            }
        }
        // If CUSTOMER added comment → notify ADMIN
        else if (!isAdminOrOwner && isOrderOwner) {
            try {
                const notifId = await Notification.create({
                    user_id: null,
                    message: `New comment on order #${id} from ${customerName}: "${commentText.substring(0, 50)}..."`,
                    type: 'comment',
                    link: `/orders/${id}`
                });
                console.log(`✓ Order comment notification created for admin: ID ${notifId}`);
            } catch (nErr) {
                console.error('❌ Failed to create admin notification:', nErr);
            }

            // Send email to admin
            try {
                if (process.env.BREVO_API_KEY) {
                    const adminEmail = getAdminNotificationEmail();
                    const html = `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
                            <h2 style="margin: 0 0 10px;">📝 New Order Comment</h2>
                            <p><strong>Order ID:</strong> #${order.id}</p>
                            <p><strong>Customer:</strong> ${customerName}</p>
                            <p><strong>Email:</strong> ${order.customer_email || 'N/A'}</p>
                            <p><strong>Comment:</strong></p>
                            <div style="padding: 12px; background: #f6f6f6; border-left: 4px solid #667eea; border-radius: 4px; margin: 10px 0;">
                                ${commentText}
                            </div>
                            <p style="margin-top: 14px;">
                                <a href="http://localhost:5173/admin/orders/${order.id}" style="display: inline-block; padding: 10px 16px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                                    View Order Details
                                </a>
                            </p>
                        </div>
                    `;
                    const text = `New Order Comment\n\nOrder ID: #${order.id}\nCustomer: ${customerName}\nEmail: ${order.customer_email || 'N/A'}\n\nComment:\n${commentText}`;

                    await sendBrevoEmailToRecipients({
                        recipients: [adminEmail],
                        subject: `💬 New Comment on Order #${order.id} from ${customerName}`,
                        text,
                        html,
                        replyTo: isValidEmail(order.customer_email)
                            ? { email: order.customer_email.trim(), name: customerName }
                            : undefined
                    });
                    console.log(`✓ Customer comment email sent to admin (order #${id})`);
                }
            } catch (eErr) {
                console.error('❌ Failed to send comment email:', eErr);
            }
        }

        res.json({ success: true, message: 'Comment added', comments });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, message: 'Error adding comment' });
    }
};

// Resend Order (owner/admin only - for Not_Delivered status)
exports.resendOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        // ADMIN SYSTEM RULE: Can only resend Not_Delivered orders
        if (order.status !== 'Not_Delivered') {
            return res.status(400).json({ success: false, message: 'System Rule: Can only resend orders marked as Not Delivered.' });
        }

        // Return to Paid so admin can deliver again in the simplified flow.
        await Order.updateStatus(id, 'Paid');
        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendOrderStatusEmail(updatedOrder, 'Paid').catch(() => {});
        }
        res.json({ success: true, message: 'Order reset to Paid for re-delivery', order: updatedOrder });
    } catch (error) {
        console.error('Error resending order:', error);
        res.status(500).json({ success: false, message: 'Error resending order' });
    }
};

// Cancel Order (owner/admin only)
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const statusLower = String(order.status || '').toLowerCase();
        if (['shipped', 'delivered', 'completed', 'cancelled', 'not_delivered'].includes(statusLower)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled after shipment has started (current status: ${order.status}).`
            });
        }

        await Order.updateStatus(id, 'Cancelled');
        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendOrderStatusEmail(updatedOrder, 'Cancelled').catch(() => {});
        }

        const refundRequired = isOrderFullyPaid(order);
        const message = refundRequired
            ? 'Order cancelled. Payment was already approved; refund process is required.'
            : 'Order cancelled.';

        res.json({ success: true, message, refundRequired, order: updatedOrder });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Error cancelling order' });
    }
};

// Cancel Order (customer for own order)
exports.cancelOwnOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const isOrderOwner = order.user_id === req.user?.id || String(order.customer_email || '').toLowerCase() === String(req.user?.email || '').toLowerCase();
        if (!isOrderOwner) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own order.' });
        }

        const blockedStatuses = ['Delivered', 'Completed', 'Cancelled', 'Not_Delivered'];
        if (blockedStatuses.includes(order.status)) {
            return res.status(400).json({ success: false, message: `Order cannot be cancelled when status is ${order.status}.` });
        }

        if (isOrderFullyPaid(order)) {
            return res.status(400).json({ success: false, message: 'This order is fully paid and can no longer be cancelled.' });
        }

        await Order.updateStatus(id, 'Cancelled');
        const updatedOrder = await Order.findById(id);
        if (shouldSendEmailsForOrder(updatedOrder)) {
            sendOrderStatusEmail(updatedOrder, 'Cancelled').catch(() => {});
        }
        res.json({ success: true, message: 'Your order has been cancelled', order: updatedOrder });
    } catch (error) {
        console.error('Error cancelling customer order:', error);
        res.status(500).json({ success: false, message: 'Error cancelling order' });
    }
};

// Delete Order (owner/admin only - permanent deletion)
exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const deleted = await Order.delete(id);
        if (deleted) {
            res.json({ success: true, message: 'Order permanently deleted' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to delete order' });
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, message: 'Error deleting order' });
    }
};

// Analytics (owner/admin only)
exports.getAnalytics = async (req, res) => {
    try {
        const { range = 'monthly' } = req.query;
        let revenueData = [];

        if (range === 'weekly') {
            revenueData = await Order.getWeeklyRevenue();
        } else if (range === 'yearly') {
            revenueData = await Order.getYearlyRevenue();
        } else {
            revenueData = await Order.getMonthlyRevenue();
        }

        const statusCounts = await Order.getStatusCounts();

        let topProducts = [];
        try {
            topProducts = await Order.getTopProducts();
        } catch (e) {
            topProducts = [];
        }

        res.json({
            success: true,
            revenueData,
            statusCounts,
            topProducts,
            range
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ success: false, message: 'Error fetching analytics' });
    }
};
