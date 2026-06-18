const express = require('express');
const router = express.Router();
const { 
    getAllProducts, 
    getProduct,
    getProductLikes,
    toggleProductLike,
    createProduct, 
    updateProduct,
    deleteProduct,
    uploadImages,
    removeProductImage,
    setMainImage,
    getReviews,
    postReview,
    getAllReviews
} = require('../controllers/productController');
const { protect, ownerOnly } = require('../middleware/authMiddleware');

router.get('/', getAllProducts);
router.get('/reviews/all', protect, ownerOnly, getAllReviews);
router.get('/:id/likes', getProductLikes);
router.post('/:id/likes/toggle', toggleProductLike);
router.get('/:id', getProduct);
// Reviews endpoints (simple file-backed store)
router.get('/:id/reviews', getReviews);
router.post('/:id/reviews', postReview);
// Protected routes: creating/updating products requires authentication
router.post('/', protect, uploadImages, createProduct);
// Only owners/admins can update or delete products
router.put('/:id', protect, ownerOnly, uploadImages, updateProduct);
router.delete('/:id', protect, ownerOnly, deleteProduct);
// Remove an image from product
router.delete('/:id/images', protect, ownerOnly, removeProductImage);
// Set main image
router.put('/:id/image-main', protect, ownerOnly, setMainImage);

module.exports = router;
