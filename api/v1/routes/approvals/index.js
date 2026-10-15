'use strict';

const express = require('express');
const router = express.Router();
const AuthHelper = require(_pathconst.FilesPath.AuthHelper);
const ApprovalController = require('../../controllers/approvals/index');

// List all approvals for the logged-in user (my requests + where I am approver)
router.get('/list', AuthHelper.authorize, ApprovalController.listApprovals);

// Searchable user list for approver picker modal (must be before /:id to avoid conflict)
router.get('/users/search', AuthHelper.authorize, ApprovalController.getCrmUsers);

// Single approval detail
router.get('/:id', AuthHelper.authorize, ApprovalController.getApproval);

// Approve a pending request (approver or master only)
router.post('/:id/approve', AuthHelper.authorize, ApprovalController.approveRequest);

// Reject a pending request
router.post('/:id/reject', AuthHelper.authorize, ApprovalController.rejectRequest);

module.exports = router;
