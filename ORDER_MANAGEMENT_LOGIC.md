# Order Management System (4-Button Logic)

## 1. Overview
This document explains the simplified order management use case using four primary actions:
- Approve
- Cancel
- Deliver
- Yes Delivered

The goal is to manage the full order lifecycle with a clear and minimal operation flow for Customer, Admin, and Owner.

## 2. Actors

### 2.1 Customer
Customer responsibilities:
- Place orders
- Upload payment proof
- Confirm delivery using Yes Delivered

Customer permissions:
- Can cancel only before payment is approved
- Can view receipt
- Can download receipt (PDF)

### 2.2 Admin
Admin responsibilities:
- Review payment proof
- Approve orders
- Process delivery flow
- Cancel orders when necessary

Admin permissions:
- Can perform all operational actions in the 4-button flow
- Can view receipt
- Can download receipt (PDF)

### 2.3 Owner
Owner responsibilities:
- Full supervision and control of order operations
- Approve, deliver, and cancel orders
- Monitor and manage workflow performance

Owner permissions:
- Same operational permissions as Admin
- Can view receipt
- Can download receipt (PDF)

## 3. Four Main Buttons and Their Logic

### 3.1 Approve
Used by Admin/Owner.

Business meaning:
- Verify payment proof
- Move order from Payment_Under_Review to Paid
- Move order from Paid to Processing

Result:
- Order becomes ready for delivery operations

### 3.2 Cancel
Used by Customer, Admin, and Owner (with rules).

Business meaning:
- Customer can cancel before payment approval
- Admin/Owner can cancel before shipment
- If order is already paid, cancellation triggers refund handling process

Result:
- Order is moved to Cancelled and no further delivery actions continue

### 3.3 Deliver
Used by Admin/Owner.

Business meaning:
- Move order from Processing to Shipped
- Move order from Shipped to Delivered

Result:
- Order reaches Delivered state and waits for customer confirmation

### 3.4 Yes Delivered
Used by Customer.

Business meaning:
- Customer confirms successful receipt of order
- Move order from Delivered to Completed

Result:
- Order is finalized as Completed

## 4. Status Journey

### 4.1 Main Flow
Waiting_Proof -> Payment_Under_Review -> Paid -> Processing -> Shipped -> Delivered -> Completed

### 4.2 Cancellation Flow
- Before approval: Customer can cancel
- Before shipment: Admin/Owner can cancel
- After payment: cancellation includes refund process

## 5. Use Case Summary

### 5.1 Place Order
- Customer creates order
- System stores order and waits for payment proof

### 5.2 Upload Payment Proof
- Customer submits payment evidence
- Order moves to Payment_Under_Review

### 5.3 Approve Order
- Admin/Owner validates proof
- Order transitions:
   - Payment_Under_Review -> Paid
   - Paid -> Processing

### 5.4 Deliver Order
- Admin/Owner performs delivery transition:
   - Processing -> Shipped
   - Shipped -> Delivered

### 5.5 Confirm with Yes Delivered
- Customer confirms receipt
- Delivered -> Completed

### 5.6 Cancel Order
- Customer cancels before payment approval
- Admin/Owner cancels before shipment
- Paid cancellation follows refund process

## 6. Receipt Access

### 6.1 Customer
- View Receipt
- Download Receipt (PDF)

### 6.2 Admin
- View Receipt
- Download Receipt (PDF)

### 6.3 Owner
- View Receipt
- Download Receipt (PDF)

## 7. Operational Benefits of 4-Button Model
- Very clear action model for all users
- Faster training and easier onboarding
- Fewer operational mistakes in status handling
- Strong traceability from order creation to completion
- Clear ownership of each action by role

## 8. Quick Reference (Button-to-Transition)
- Approve: Payment_Under_Review -> Paid -> Processing
- Cancel: Any allowed pre-shipment stage -> Cancelled
- Deliver: Processing -> Shipped -> Delivered
- Yes Delivered: Delivered -> Completed

## 9. Messages and Comments (Continue Working)

### 9.1 Messages
- Messaging flow remains active and compatible with the 4-button workflow.
- Order lifecycle actions (Approve, Cancel, Deliver, Yes Delivered) do not disable or remove messaging behavior.
- Customers, Admin, and Owner can continue communication according to role-based access rules.

### 9.2 Order Comments
- Comment feature remains active in the order workflow.
- Admin/Owner can comment on orders at any stage.
- Customer can comment on their own order.
- Comments support operational tracking, delivery notes, and dispute handling.

### 9.3 Business Continuity Rule
- Introducing 4-button logic does not break message or comment functions.
- Communication features continue to work as part of normal order management operations.

## 10. Dashboard Updates (All Dashboards Updated)

### 10.1 Customer Dashboard
- Shows current order status across the simplified flow.
- Shows allowed actions based on stage:
   - Cancel (before payment approval)
   - Yes Delivered (after order reaches Delivered)
- Receipt actions are visible when eligible:
   - View Receipt
   - Download Receipt (PDF)

### 10.2 Admin Dashboard
- Uses 4 operational buttons: Approve, Cancel, Deliver, and status supervision.
- Shows payment proof review context and delivery stage progression.
- Keeps message/comment panels available for order coordination.

### 10.3 Owner Dashboard
- Mirrors Admin operational controls with full oversight.
- Includes global monitoring for approvals, cancellations, deliveries, and completions.
- Keeps message/comment visibility for supervision and escalation.

### 10.4 Analytics and Operational Views
- Dashboards continue reflecting updated order states and transitions.
- Revenue/order metrics stay aligned with the current status lifecycle.
- Top-level operational indicators remain usable after the 4-button model update.

## 11. Implementation Note
- The 4-button logic is the primary operational model.
- Message, comment, receipt, and dashboard features continue working alongside it.
- This keeps operations simple while preserving full communication and monitoring capabilities.

---
This document defines the simplified 4-button business workflow for the order management system and can be used as the reference for UI, backend rules, and user training.