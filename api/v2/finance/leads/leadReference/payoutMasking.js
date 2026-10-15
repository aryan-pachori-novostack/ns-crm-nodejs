const { getModuleColumnsByRole } = require('../../../../services/roles-service');

/**
 * Display labels only (e.g. future UI/logging use) — NOT used to match
 * rbac_rules.resource_list. Kept in sync with the frontend's
 * leadReferenceFieldConfig.js labels, but the actual RBAC match key is the
 * field key itself (see getPayoutRoleRule/isPayoutFieldVisible below) —
 * the Roles admin UI's picklist Autocomplete saves each option's `alias`
 * (its backend field key, e.g. `vendor_payout_type`) into resource_list,
 * not its display label, so matching against labels here would silently
 * never fire once a real picklist-driven rule is saved.
 */
const PAYOUT_FIELD_LABELS = {
    vendor_payout_type: 'Payout Type',
    vendor_payout_rate: 'Payout Rate',
    vendor_payout_ratio: 'Payout Ratio'
};

/**
 * Role-level mask/unmask override for the Lead Reference Comparison's payout fields,
 * sourced from the same rbac_rules table + getModuleColumnsByRole helper that
 * jobs/processors/getLedgerDataOnEmailNew.js uses for the ledger email's column
 * masking (resource_key 'finance_claim_payout', resource_type 'column').
 * rule.visible === 1 ("Show" in the admin UI) means the listed fields are an
 * explicit UNMASK grant for this role; rule.visible === 0 ("Hide") means the
 * listed fields are an explicit force-MASK, overriding hierarchy ownership either way.
 * `resource_list` entries are field keys (vendor_payout_type/vendor_payout_rate/
 * vendor_payout_ratio — matching each picklist option's `alias`, or typed
 * verbatim via the admin UI's freeform-text fallback), not display labels.
 * Returns null when the role has no rule (or no role at all) — callers fall back to
 * the hierarchy-ownership check.
 */
const getPayoutRoleRule = async (role) => {
    if (!role) return null;
    const rule = await getModuleColumnsByRole(role, 'finance_claim_payout', 'column');
    if (!rule || !rule.resource_list) return null;
    const fields = new Set(rule.resource_list.split(',').map((s) => s.trim()).filter(Boolean));
    if (!fields.size) return null;
    return { visible: rule.visible === 1, fields };
};

/**
 * Precedence, deliberately with NO hardcoded role bypass (e.g. no CEO/superadmin
 * special-case) — the rbac_rules granular rule (see getPayoutRoleRule) is the sole
 * override, per field:
 * 1. A role-level rule covering this field decides it (visible:1 unmask, visible:0
 *    force-mask), full stop.
 * 2. Otherwise, fall back to hierarchy ownership: same rule as
 *    UploaderAuthorizationValidator (api/v2/finance/leads/claims/claimValidators.js)
 *    — a matched lead "belongs" to the viewer's team when the viewer's dsa_id sits
 *    in that lead's materialized current_hierarchy_path.
 */
const isPayoutFieldVisible = (fieldKey, matchHierarchyPath, viewer, roleRule) => {
    if (roleRule && roleRule.fields.has(fieldKey)) {
        return roleRule.visible;
    }

    if (!viewer?.dsa_id) return false;
    return Boolean(matchHierarchyPath && String(matchHierarchyPath).includes(String(viewer.dsa_id)));
};

/**
 * Strip payout fields from matched leads the viewer isn't allowed to see, per field
 * (hierarchy ownership by default, overridden by a role-level mask/unmask rule when
 * one exists — see isPayoutFieldVisible). `payout_masked_fields` lists exactly which
 * of the three fields were nulled on this row, so the frontend can mask only those
 * (a role rule can unmask e.g. just Payout Type while leaving Rate/Ratio masked).
 */
const maskCrossTeamPayoutDetails = (rows, viewer, roleRule) => {
    return rows.map((row) => {
        const maskedFields = [];
        const maskedRow = { ...row };

        for (const fieldKey of Object.keys(PAYOUT_FIELD_LABELS)) {
            if (!isPayoutFieldVisible(fieldKey, row.current_hierarchy_path, viewer, roleRule)) {
                maskedRow[fieldKey] = null;
                maskedFields.push(fieldKey);
            }
        }

        maskedRow.payout_masked = maskedFields.length > 0;
        maskedRow.payout_masked_fields = maskedFields;
        return maskedRow;
    });
};

module.exports = {
    PAYOUT_FIELD_LABELS,
    getPayoutRoleRule,
    isPayoutFieldVisible,
    maskCrossTeamPayoutDetails
};
