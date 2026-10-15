const ExportPermissionService = require('../../services/export-permission-service');

/**
 * Export authorization middleware.
 *
 * Usage: wire into any export-tagged route, e.g.:
 *   router.post("/getExpenses", AuthHelper.authorize, RBACMiddleware.authorize([...], 'read'),
 *     ExportMiddleware.authorizeExport('finance_invoices_office_expenses', (req) => req.body.type === 'Export'),
 *     BillsControllerV1.getExpenses);
 *
 * @param {string|((req) => string)} moduleAlias - rbac_modules.alias this export belongs to.
 *   Most routes pass a fixed string. Routes shared across several sub-modules (e.g. one
 *   applications endpoint serving car loan, home loan, etc. via req.body.loan_type) can
 *   instead pass a resolver function that reads the request and returns the specific alias
 *   for that sub-module -- see LOAN_TYPE_EXPORT_ALIAS below for an example table.
 * @param {(req) => boolean} [isExportRequest] - Optional predicate for endpoints that serve
 *   both normal reads AND export from the same route (very common in this app -- e.g.
 *   getExpenses branches on req.body.type === 'Export'). When provided and it returns
 *   false, the check is skipped entirely (not an export request, let it through as normal).
 *   Omit for routes that are export-only.
 */
const authorizeExport = (moduleAlias, isExportRequest = null) => {
    return async (req, res, next) => {
        try {
            if (isExportRequest && !isExportRequest(req)) {
                return next();
            }

            // Deliberately no superadmin bypass here, unlike RBACMiddleware -- export is the
            // one action this whole system exists to control and audit, so even a superadmin
            // needs an explicit per-user grant (and gets logged) rather than silently skipping
            // both the check and the audit trail.

            const userId = req.loggedInUser?.id;
            const requestIp = req.ip;

            if (!userId) {
                return res.status(403).json({
                    meta: { Status: false, Message: 'Export blocked: unable to identify user.', code: 403 },
                    Data: {}, Token: ''
                });
            }

            const resolvedModuleAlias = typeof moduleAlias === 'function' ? moduleAlias(req) : moduleAlias;

            const { allowed } = await ExportPermissionService.checkExportPermission({
                userId,
                moduleAlias: resolvedModuleAlias,
                requestIp
            });

            if (!allowed) {
                return res.status(403).json({
                    meta: {
                        Status: false,
                        Message: "Export blocked: Your current network/device is not authorized for exporting data from this module. Please connect using the registered network or contact the CRM administrator.",
                        code: 403
                    },
                    Data: {},
                    Token: ''
                });
            }

            next();
        } catch (error) {
            console.error('Export Middleware Error:', error.message);
            return res.status(403).json({
                meta: { Status: false, Message: 'Export authorization failed.', code: 403 },
                Data: {}, Token: ''
            });
        }
    };
};

/**
 * Restricts a route to the CEO/CTO roles. Used to gate granting/editing export
 * permissions on a user's profile -- viewing stays behind the normal module
 * permission, but only CEO/CTO can change what a user is allowed to export.
 */
const requireCeo = (req, res, next) => {
    if (['CEO', 'CTO'].includes(req.loggedInUser?.role)) {
        return next();
    }
    return res.status(403).json({
        meta: { Status: false, Message: 'Only the CEO or CTO can grant or edit export permissions.', code: 403 },
        Data: {}, Token: ''
    });
};

module.exports = { authorizeExport, requireCeo };
