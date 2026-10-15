/** MUI X filterModel field → SQL column for ru_customers (getCustomers). */
exports.getCustomersFieldMapping = (field) => {
    const fieldMap = {
        id: 'c.id',
        customer_id: 'c.customer_id',
        full_name: 'c.full_name',
        customer_mobile_number: 'c.customer_mobile_number',
        dsa_mobile_number: 'c.dsa_mobile_number',
        email_address: 'c.email_address',
        permanent_account_number: 'c.permanent_account_number',
        date_of_birth: 'DATE(c.date_of_birth)',
        gender: 'c.gender',
        age: 'c.age',
        address_city: 'c.address_city',
        address_state: 'c.address_state',
        address_pincode: 'c.address_pincode',
        is_mobile_number_verified: 'c.is_mobile_number_verified',
        source_from: 'c.source_from',
        device_type: 'c.device_type',
        sp_mobile_number: 'c.sp_mobile_number',
        sp_name: 'sp.full_name',
        dsa_name: 'dsa.full_name',
        created_at: 'DATE(c.created_at)',
        utm_source: "cl_utm.utm_source",
        utm_medium: "cl_utm.utm_medium",
        utm_campaign: "cl_utm.utm_campaign",
        utm_content: "cl_utm.utm_content",
        utm_channel: "cl_utm.utm_channel",
        utm_term: "cl_utm.utm_term",
        utm_id: "cl_utm.utm_id",
        campaignid: "cl_utm.campaign_id",
        adgroupid: "cl_utm.ad_group_id",
        ad: "cl_utm.ad",
        mt: "cl_utm.mt",
        adpos: "cl_utm.adpos",
        gad: "cl_utm.gad",
        gclid: "cl_utm.gclid",
        fbclid: "cl_utm.fbclid",
        utm_adgroup: "cl_utm.utm_adgroup",
        utm_main_source: "cl_utm.utm_main_source",
        page_source: "cl_utm.page_source",
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllCCApplications. */
exports.getAllCCApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'cc.application_id',
        external_id: 'cc.external_id',
        customer_id: 'cc.customer_id',
        status_description: 'cc.status_description',
        stage: 'cc.stage',
        sub_stage: 'cc.sub_stage',
        status: 'cc.status',
        product_id: 'cc.product_id',
        created_at: 'DATE(cc.created_at)',
        dsa_name: 'd.full_name',
        partner_name: 'd.full_name',
        dsa_mobile_number: 'd.dsa_mobile_number',
        partner_mobile: 'd.dsa_mobile_number',
        business_head_name: 'bh.full_name',
        bh_name: 'bh.full_name',
        customer_name: 'c.full_name',
        customer_full_name: 'c.full_name',
        permanent_account_number: 'c.permanent_account_number',
        mobile_number: 'c.customer_mobile_number',
        customer_mobile_number: 'c.customer_mobile_number',
        customer_email: 'c.email_address',
        email_address: 'c.email_address',
        city: 'ca.city',
        pin_code: 'c.address_pincode',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getCibilList. */
exports.getCibilListFieldMapping = (field) => {
    const fieldMap = {
        id: 'cs.id',
        customer_id: 'c.customer_id',
        dsa_id: 'cs.dsa_id',
        customer_name: 'c.full_name',
        partner_name: 'p.full_name',
        business_head_name: 'bh.full_name',
        dsa_mobile_number: 'c.dsa_mobile_number',
        state: 'c.address_state',
        city: 'c.address_city',
        pin_code: 'ca.pin_code',
        mobile_number: 'cs.mobile_number',
        permanent_account_number: 'cs.permanent_account_number',
        email: 'cs.email',
        credit_score: 'cs.credit_score',
        created_at: 'DATE(cs.created_at)',
        updated_at: 'DATE(cs.updated_at)',
        last_checked_date_iso: 'DATE(cs.last_checked_date_iso)',
    };
    return fieldMap[field] || field;
};

const BAJAJ_APPLICATION_STATUS_SQL = `(CASE WHEN rbpla.custom_status = 0 THEN 'Pending' WHEN rbpla.custom_status = 1 THEN 'Approved/Completed' WHEN rbpla.custom_status = 2 THEN 'Rejected' WHEN rbpla.custom_status = 3 THEN 'Dsibursed' END)`;

/** MUI X filterModel field → SQL column for getAllBajajApplications. */
exports.getAllBajajApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rbpla.application_id',
        lan: 'rbpla.lan',
        full_name: `concat(rbpla.first_name, ' ', rbpla.last_name)`,
        customer_name: `concat(rbpla.first_name, ' ', rbpla.last_name)`,
        mobile_number: 'rbpla.mobile_number',
        salutation: 'rbpla.salutation',
        requested_loan_amount: 'rbpla.requested_loan_amount',
        requested_tenor_in_months: 'rbpla.requested_tenor_in_months',
        stage: 'rbpla.stage',
        sub_stage: 'rbpla.sub_stage',
        disburse_amount: 'rbpla.disburse_amount',
        disburse_date: 'DATE(rbpla.disburse_date)',
        created_at: 'DATE(rbpla.created_at)',
        updated_at: 'DATE(rbpla.updated_at)',
        partner_unique_id: 'rbpla.partner_unique_id',
        employment_type: 'rbpla.employment_type',
        response_message: 'rbpla.response_message',
        status: BAJAJ_APPLICATION_STATUS_SQL,
        custom_status: 'rbpla.custom_status',
        business_head_name: 'bh.full_name',
        dsa_name: 'c.full_name',
        dsa_mobile_number: 'rbpla.dsa_mobile_number',
        pan: 'rbpla.pan',
        rm_name: 'rbsp.sp_name',
        rm_number: 'rbsp.sp_mobile',
    };
    return fieldMap[field] || field;
};

const CREDIT_VIDYA_APPLICATION_STATUS_SQL = `(CASE WHEN rcvpla.custom_status = 0 THEN 'Pending' WHEN rcvpla.custom_status = 1 THEN 'Approved/Completed' WHEN rcvpla.custom_status = 2 THEN 'Rejected' WHEN rcvpla.custom_status = 3 THEN 'Disbursed' END)`;

/** MUI X filterModel field → SQL column for getAllCreditVidyaApplications. */
exports.getAllCreditVidyaApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rcvpla.application_id',
        full_name: `concat(rcvpla.first_name, ' ', rcvpla.last_name)`,
        customer_name: `concat(rcvpla.first_name, ' ', rcvpla.last_name)`,
        mobile_number: 'rcvpla.mobile_number',
        pan: 'rcvpla.pan',
        employment_type: 'rcvpla.employment_type',
        desired_loan_amount: 'rcvpla.desired_loan_amount',
        loan_amount: 'rcvpla.loan_amount',
        stage: 'rcvpla.stage',
        sub_stage: 'rcvpla.sub_stage',
        reject_reason: 'rcvpla.reject_reason',
        disburse_amount: 'rcvpla.disburse_amount',
        disburse_date: 'DATE(rcvpla.disburse_date)',
        created_at: 'DATE(rcvpla.created_at)',
        updated_at: 'DATE(rcvpla.updated_at)',
        status: CREDIT_VIDYA_APPLICATION_STATUS_SQL,
        custom_status: 'rcvpla.custom_status',
        business_head_name: 'bh.full_name',
        dsa_name: 'c.full_name',
        dsa_mobile_number: 'rcvpla.dsa_mobile_number',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllFibeApplications. */
exports.getAllFibeApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rfpla.application_id',
        disburse_amount: 'rfpla.disburse_amount',
        stage: 'rfpla.stage',
        sub_stage: 'rfpla.sub_stage',
        full_name: `concat(rfpla.firstname, ' ', rfpla.lastname)`,
        customer_name: `concat(rfpla.firstname, ' ', rfpla.lastname)`,
        esRefId: 'rfpla.esRefId',
        agentId: 'rfpla.agentId',
        salary: 'rfpla.salary',
        agentName: 'rfpla.agentName',
        agentMobileNo: 'rfpla.agentMobileNo',
        sanctionLimit: 'rfpla.sanctionLimit',
        profession: 'rfpla.profession',
        status: 'rfpla.status',
        reason: 'rfpla.reason',
        inPrincipleLimit: 'rfpla.inPrincipleLimit',
        inPrincipleTenure: 'rfpla.inPrincipleTenure',
        disbursed_date: 'DATE(rfpla.disbursed_date)',
        created_at: 'DATE(rfpla.created_at)',
        updated_at: 'DATE(rfpla.updated_at)',
        business_head_name: 'bh.full_name',
        dsa_name: 'c.full_name',
        pan: 'rfpla.pan',
        mobilenumber: 'rfpla.mobilenumber',
        mobile_number: 'rfpla.mobilenumber',
        dsa_mobile_number: 'rfpla.dsa_mobile_number',
    };
    return fieldMap[field] || field;
};

const LNT_APPLICATION_STATUS_SQL = `(CASE WHEN lt.application_status = '1' THEN 'Customer Basic Details Saved' WHEN lt.application_status = '2' THEN 'Consent Form Signed' WHEN lt.application_status = '3' THEN 'Application In Process' WHEN lt.application_status = '4' THEN 'Lead Generated' WHEN lt.application_status = '5' THEN 'Application In Process' WHEN lt.application_status = '6' THEN 'Application Rejected' WHEN lt.application_status = '7' THEN 'Loan Disbursed' ELSE 'NA' END)`;

/** MUI X filterModel field → SQL column for getAllLntApplications. */
exports.getAllLntApplicationsFieldMapping = (field) => {
    const fieldMap = {
        id: 'lt.id',
        application_id: 'lt.application_id',
        login_date: 'DATE(lt.application_date_iso)',
        application_status: 'lt.application_status',
        customer_mobile_number: 'd.customer_mobile_number',
        employment_type: 'lt.employment_type',
        salary_per_annum: 'lt.salary_per_annum',
        loan_amount: 'lt.loan_amount',
        loan_tenure: 'lt.loan_tenure',
        total_work_exp: 'lt.total_work_exp',
        created_at: 'DATE(lt.created_at)',
        updated_at: 'DATE(lt.updated_at)',
        disbursed_amount: 'ltm.bre_max_eligibility',
        failure_reason: 'ltm.failure_reason',
        app_ref: 'ltm.app_ref',
        sub_stage: 'ltm.sub_stage',
        stage: 'ltm.stage',
        disbursal_date: 'DATE(ltm.disbursal_date_iso)',
        status: LNT_APPLICATION_STATUS_SQL,
        dsa_name: 'c.full_name',
        partner_name: 'c.full_name',
        customer_name: 'd.full_name',
        state: 'd.address_state',
        city: 'd.address_city',
        customer_email_address: 'd.email_address',
        business_head_name: 'bh.full_name',
        dsa_mobile_number: 'lt.dsa_mobile_number',
        partner_code: 'c.partner_code',
        permanent_account_number: 'd.permanent_account_number',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllLoanApplications. */
exports.getAllLoanApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'l.application_id',
        loan_amount: 'l.loan_amount',
        salary_per_annum: 'l.salary_per_annum',
        loan_tenure: 'l.loan_tenure',
        organisation_name: 'l.organisation_name',
        organization_name: 'l.organisation_name',
        created_at: 'DATE(l.created_at)',
        loan_type: 'lt.loan_name',
        type: 'lt.loan_name',
        dsa_name: 'c.full_name',
        partner_name: 'c.full_name',
        customer_name: 'd.full_name',
        state: 'd.address_state',
        city: 'd.address_city',
        status: 'lst.application_status_description',
        dsa_mobile_number: 'd.dsa_mobile_number',
        customer_mobile_number: 'd.customer_mobile_number',
        permanent_account_number: 'l.permanent_account_number',
        customer_pan: 'd.permanent_account_number',
        pan: 'l.permanent_account_number',
        cibil: 'lm.cibil_range',
        assigned_to_name: 'sa.name',
        assigned_by_name: 'sab.name',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllIncredApplications. */
exports.getAllIncredApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'ripla.application_id',
        incred_application_id: 'ripla.incred_application_id',
        full_name: `concat(ripla.fname, ' ', ripla.lname)`,
        customer_name: `concat(ripla.fname, ' ', ripla.lname)`,
        email: 'ripla.email',
        emp_monthly_salary: 'ripla.emp_monthly_salary',
        employment_type: 'ripla.employment_type',
        bank_account_holder_name: 'ripla.bank_account_holder_name',
        bank_account_number: 'ripla.bank_account_number',
        bank_account_type: 'ripla.bank_account_type',
        ifsc_code: 'ripla.ifsc_code',
        loan_amount: 'ripla.loan_amount',
        requested_loan_amount: 'ripla.loan_amount',
        max_loan_tenure: 'ripla.max_loan_tenure',
        requested_tenor: 'ripla.max_loan_tenure',
        reason: 'ripla.reason',
        stage: 'ripla.stage',
        sub_stage: 'ripla.sub_stage',
        status: 'ripla.status',
        disburse_amount: 'ripla.disburse_amount',
        disburse_date: 'DATE(ripla.disburse_date)',
        created_at: 'DATE(ripla.created_at)',
        updated_at: 'DATE(ripla.updated_at)',
        business_head_name: 'bh.full_name',
        dsa_name: 'c.full_name',
        pan: 'ripla.pan',
        mobile: 'ripla.mobile',
        mobile_number: 'ripla.mobile',
        dsa_mobile_number: 'ripla.dsa_mobile_number',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllPayUApplications. */
exports.getAllPayUApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rpula.application_id',
        app_reference_id: 'rpula.app_reference_id',
        monthly_income: 'rpula.monthly_income',
        email: 'rpula.email',
        approved_limit: 'rpula.approved_limit',
        employment_type: 'rpula.employment_type',
        status: 'rpula.status',
        rejected_reason: 'rpula.rejected_reason',
        full_name: `concat(rpula.first_name, ' ', rpula.last_name)`,
        customer_name: `concat(rpula.first_name, ' ', rpula.last_name)`,
        disburse_amount: 'rpula.approved_limit',
        disbursed_date: 'DATE(rpula.disbursed_date)',
        created_at: 'DATE(rpula.created_at)',
        updated_at: 'DATE(rpula.updated_at)',
        business_head_name: 'bh.full_name',
        dsa_name: 'c.full_name',
        pan: 'rpula.pan',
        phone: 'rpula.phone',
        dsa_mobile_number: 'rpula.dsa_mobile_number',
        sub_status: 'rgs.sub_status',
        ru_status: 'rgs.ru_status',
        actions_required: 'rgs.actions_required',
        status_description: 'rgs.description',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllIndifiApplications. */
exports.getAllIndifiApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rifl.application_id',
        request_id: 'riflm.request_id',
        indifi_application_id: 'riflm.indifi_application_id',
        application_date: 'DATE(rifl.application_date)',
        application_status: 'rifl.application_status',
        dsa_mobile_number: 'rifl.dsa_mobile_number',
        customer_mobile_number: 'rifl.customer_mobile_number',
        permanent_account_number: 'rifl.permanent_account_number',
        pan: 'rifl.permanent_account_number',
        loan_amount: 'rifl.loan_amount',
        loan_tenure: 'rifl.loan_tenure',
        facility_type: 'rifl.facility_type',
        business_id: 'rifl.business_id',
        business_name: 'rifl.business_name',
        business_type: 'rifl.business_type',
        incorporation_date: 'DATE(rifl.incorporation_date)',
        average_monthly_revenue: 'rifl.average_monthly_revenue',
        business_nature: 'rifl.business_nature',
        segment_category_id: 'rifl.segment_category_id',
        segment_category_name: 'rifl.segment_category_name',
        segment: 'rifl.segment_category_name',
        requested_loan_amount: 'riflm.requested_loan_amount',
        offered_loan_amount: 'riflm.offered_loan_amount',
        disbursed_date: 'DATE(riflm.disbursal_date_iso)',
        status: 'riflst.application_status_description',
        stage: 'riflm.state',
        sub_stage: 'riflm.status',
        dsa_name: 'c.full_name',
        customer_name: 'd.full_name',
        state: 'd.address_state',
        city: 'd.address_city',
        customer_email_address: 'd.email_address',
        customer_email: 'd.email_address',
        created_at: 'DATE(rifl.created_at)',
        updated_at: 'DATE(rifl.updated_at)',
        partner_code: 'c.partner_code',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllPiramalLapApplications. */
exports.getAllPiramalLapApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rlpa.application_id',
        lead_id: 'rlpa.lead_id',
        full_name: `concat(rlpa.first_name, ' ', rlpa.last_name)`,
        customer_name: `concat(rlpa.first_name, ' ', rlpa.last_name)`,
        pan: 'rlpa.pan',
        mobile_number: 'rlpa.mobile_number',
        profession: 'rlpa.profession',
        occupation_type: 'rlpa.occupation_type',
        requested_amount: 'rlpa.requested_amount',
        approved_tenure: 'rlpa.approved_tenure',
        stage: 'rlpa.lead_status',
        sub_stage: 'rlpa.risk_decision_type',
        status: 'rlpa.status',
        lead_status: 'rlpa.status',
        reject_reason: 'rlpa.reject_reason',
        disburse_amount: 'rlpa.disburse_amount',
        disburse_date: 'DATE(rlpa.disburse_date)',
        created_at: 'DATE(rlpa.created_at)',
        updated_at: 'DATE(rlpa.updated_at)',
        dsa_name: 'd.full_name',
        dsa_mobile_number: 'rlpa.dsa_mobile_number',
        business_head_name: 'bh.full_name',
        sp_name: 'sp.sp_name',
        sp_mobile: 'sp.sp_mobile',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllPiramalApplications. */
exports.getAllPiramalApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rphla.application_id',
        lead_id: 'rphla.lead_id',
        full_name: `concat(rphla.first_name, ' ', rphla.last_name)`,
        customer_name: `concat(rphla.first_name, ' ', rphla.last_name)`,
        pan: 'rphla.pan',
        mobile_number: 'rphla.mobile_number',
        email: 'rphla.email',
        occupation_type: 'rphla.occupation_type',
        branch_name: 'rphla.branch_name',
        branch_code: 'rphla.branch_code',
        requested_amount: 'rphla.requested_amount',
        requested_tenure: 'rphla.requested_tenure',
        stage: 'rphla.lead_status',
        sub_stage: 'rphla.risk_decision_type',
        status: 'rphla.status',
        lead_status: 'rphla.status',
        reject_reason: 'rphla.reject_reason',
        disburse_amount: 'rphla.disburse_amount',
        disburse_date: 'DATE(rphla.disburse_date)',
        created_at: 'DATE(rphla.created_at)',
        updated_at: 'DATE(rphla.updated_at)',
        dsa_name: 'c.full_name',
        dsa_mobile_number: 'rphla.dsa_mobile_number',
        business_head_name: 'bh.full_name',
        sp_name: 'sp.sp_name',
        sp_mobile: 'sp.sp_mobile',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllPendingLAPApplications. */
exports.getAllPendingLAPApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rhla.application_id',
        dsa_name: 'd.full_name',
        dsa_mobile_number: 'rhla.dsa_mobile_number',
        customer_name: 'c.full_name',
        permanent_account_number: 'rhla.permanent_account_number',
        customer_mobile_number: 'rhla.customer_mobile_number',
        profession_name: 'rdp.profession_name',
        loan_amount: 'rhla.loan_amount',
        loan_tenure: 'rhla.loan_tenure',
        application_status_description: 'rhlps.application_status_description',
        business_head_name: 'bh.full_name',
        address_pincode: 'c.address_pincode',
        created_at: 'DATE(rhla.created_at)',
        updated_at: 'DATE(rhla.updated_at)',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getAllPendingHlApplications. */
exports.getAllPendingHlApplicationsFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'rhla.application_id',
        dsa_name: 'd.full_name',
        dsa_mobile_number: 'rhla.dsa_mobile_number',
        customer_name: 'c.full_name',
        permanent_account_number: 'rhla.permanent_account_number',
        customer_mobile_number: 'rhla.customer_mobile_number',
        profession_name: 'rdp.profession_name',
        loan_amount: 'rhla.loan_amount',
        loan_tenure: 'rhla.loan_tenure',
        application_status_description: 'rhlps.application_status_description',
        business_head_name: 'bh.full_name',
        address_pincode: 'c.address_pincode',
        created_at: 'DATE(rhla.created_at)',
        updated_at: 'DATE(rhla.updated_at)',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getBbpsPayments. */
exports.getBbpsPaymentsFieldMapping = (field) => {
    const fieldMap = {
        id: 'bbps.id',
        customer_id: 'bbps.customer_id',
        customer_full_name: 'CONCAT_WS(" ", c.first_name, c.middle_name, c.last_name)',
        customer_mobile_number: 'c.customer_mobile_number',
        dsa_full_name: 'CONCAT_WS(" ", d.first_name, d.middle_name, d.last_name)',
        dsa_mobile_number: 'd.dsa_mobile_number',
        biller_name: 'bbps.biller_name',
        biller_category: 'bbps.biller_category',
        amount_paid: 'bbps.amount_paid',
        created_at: 'DATE(bbps.created_at)',
        updated_at: 'DATE(bbps.updated_at)',
        txn_id: 'bbps.txn_id',
        txn_url: 'bbps.txn_url',
        status: 'bbps.status',
        biller_id: 'bbps.biller_id',
        session_id: 'bbps.session_id',
        reference_id: 'bbps.reference_id',
        bill_number: 'bpd.bill_number',
        bill_amount: 'bpd.bill_amount',
        due_date: 'DATE(bpd.due_date)',
    };
    return fieldMap[field] || field;
};

exports.getDsaLeadsFieldMapping = (field) => {
    const latestCallStatusSubquery = "(SELECT cl.call_status FROM ru_call_logs cl WHERE cl.entity_type_id = dl.id AND cl.entity = 'dsa' AND cl.entity_type = 'leads' AND cl.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ORDER BY cl.created_at DESC, cl.id DESC LIMIT 1)";
    const latestCallRemarksSubquery = "(SELECT cl.remarks FROM ru_call_logs cl WHERE cl.entity_type_id = dl.id AND cl.entity = 'dsa' AND cl.entity_type = 'leads' AND cl.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) ORDER BY cl.created_at DESC, cl.id DESC LIMIT 1)";
    const fieldMap = {
        id: 'dl.id',
        lead_id: 'dl.id',
        dsa_id: 'dl.dsa_id',
        bucket: 'dl.bucket',
        status: 'dl.status',
        lead_status: 'dl.status',
        status_name: 'pv.value',
        partner_id: 'p.dsa_id',
        partner_name: 'CONCAT(p.first_name, \' \', COALESCE(p.middle_name, \'\'), \' \', p.last_name)',
        partner: 'CONCAT(p.first_name, \' \', COALESCE(p.middle_name, \'\'), \' \', p.last_name)',
        dsa_name: 'c.full_name',
        phone: 'dl.phone',
        partner_phone: 'dl.partner_phone',
        full_name: 'dl.full_name',
        email: 'dl.email',
        lead_remarks: 'dl.lead_remarks',
        city: 'dl.city',
        state: 'dl.state',
        pincode: 'dl.pincode',
        salesperson_id: 'dl.salesperson_id',
        salesperson_name: 'sp.name',
        salesperson: 'sp.name',
        salesperson_assigned_date: 'dl.salesperson_assigned_date',
        call_status: latestCallStatusSubquery,
        latest_call_status: latestCallStatusSubquery,
        call_remarks: latestCallRemarksSubquery,
        latest_call_remarks: latestCallRemarksSubquery,
        utm_source: 'dl.utm_source',
        utm_medium: 'dl.utm_medium',
        utm_campaign: 'dl.utm_campaign',
        utm_channel: 'dl.utm_channel',
        utm_content: 'dl.utm_content',
        utm_term: 'dl.utm_term',
        utm_id: 'dl.utm_id',
        utm_adgroup: 'dl.utm_adgroup',
        utm_main_source: 'dl.utm_main_source',
        utm_device: 'dl.utm_device',
        page_source: 'dl.page_source',
        campaign_id: 'dl.campaign_id',
        ad_group_id: 'dl.ad_group_id',
        created_at: 'dl.created_at',
        created_date: 'dl.created_at',
        updated_at: 'dl.updated_at',
        claim_id: 'dl.claim_id'
    };
    return fieldMap[field] || field;
};

exports.getDsaPayoutListFieldMapping = (field) => {
    const fieldMap = {
        'bank_name': 'nb.bank_name',
        'main_product': 'np.main_product',
        'sub_product': 'np.product_name',
        'login_code': 'd.login_code',
        'payout_percentage_lead': 'rdp.rate',
        'ratio': 'rdp.ratio',
        'id': 'rdp.id',
        'autonomous_rate': 'rdp.autonomous_rate',
        'autonomous_ratio': 'rdp.autonomous_ratio',
        'disb_date_from': 'rdp.disb_date_from',
        'disb_date_to': 'rdp.disb_date_to',
    };

    return fieldMap[field] || field;
};

/** doc_unique_id in ru_dsa_documents = ru_dsa_bank_accounts.id (PK), stored as string. */
const buildBankAccountDocPathSubquery = (alias, docName) =>
    `(SELECT doc_path FROM ru_dsa_documents WHERE dsa_id = ${alias}.dsa_id AND doc_unique_id = CAST(${alias}.id AS CHAR) AND doc_name = '${docName}' ORDER BY created_at DESC LIMIT 1)`;

exports.SQL_BANK_ACCOUNT_CHEQUE_IMAGE = (alias = "ba") => buildBankAccountDocPathSubquery(alias, "cheque");
exports.SQL_BANK_ACCOUNT_PASSBOOK_IMAGE = (alias = "ba") => buildBankAccountDocPathSubquery(alias, "passbook");

/** Prefer primary+approved; fallback to most recently updated (LIMIT 1 pick). */
exports.SQL_BANK_ACCOUNT_PREFERRED_ORDER_BY = (alias = "ba") => {
    const prefix = alias ? `${alias}.` : "";
    return `CASE WHEN LOWER(COALESCE(${prefix}tag, '')) = 'primary' AND LOWER(COALESCE(${prefix}status, '')) IN ('approved', 'active') THEN 0 ELSE 1 END, ${prefix}updated_at DESC, ${prefix}id DESC`;
};

const buildPreferredBankAccountIdSubquery = (keyColumn, parentKeyExpr, extraSubqueryWhereClause = "") =>
    `(SELECT ba_pick.id FROM ru_dsa_bank_accounts ba_pick WHERE ba_pick.${keyColumn} = ${parentKeyExpr}${extraSubqueryWhereClause ? ` AND ${extraSubqueryWhereClause}` : ""} ORDER BY ${exports.SQL_BANK_ACCOUNT_PREFERRED_ORDER_BY("ba_pick")} LIMIT 1)`;


exports.sqlPreferredBankAccountJoinByDsaId = (joinAlias, parentDsaIdExpr, extraOnClause = "", excludeCompanyLinked = true) =>
    `LEFT JOIN ru_dsa_bank_accounts ${joinAlias} ON ${joinAlias}.id = ${buildPreferredBankAccountIdSubquery("dsa_id", parentDsaIdExpr, excludeCompanyLinked ? "ba_pick.company_id IS NULL" : "")}${extraOnClause ? ` AND ${extraOnClause}` : ""}`;

exports.sqlPreferredBankAccountJoinByCompanyId = (joinAlias, parentCompanyIdExpr, extraOnClause = "") =>
    `LEFT JOIN ru_dsa_bank_accounts ${joinAlias} ON ${joinAlias}.id = ${buildPreferredBankAccountIdSubquery("company_id", parentCompanyIdExpr)}${extraOnClause ? ` AND ${extraOnClause}` : ""}`;

/** Company bank first when company_id is set; otherwise preferred individual bank by dsa_id. */
exports.sqlPreferredBankAccountJoinByDsaOrCompanyId = (joinAlias, dsaIdExpr, companyIdExpr) =>
    `LEFT JOIN ru_dsa_bank_accounts ${joinAlias} ON ${joinAlias}.id = COALESCE(
        ${buildPreferredBankAccountIdSubquery("company_id", companyIdExpr)},
        ${buildPreferredBankAccountIdSubquery("dsa_id", dsaIdExpr)}
    )`;

exports.getPendingBankVerificationFieldMapping = (field) => {
    const fieldMap = {
        id: "ba.id",
        dsa_id: "ba.dsa_id",
        dsa_mobile_number: "COALESCE(rc.phone, d.dsa_mobile_number)",
        full_name: "COALESCE(rc.name, d.full_name)",
        email_address: "d.email_address",
        account_holder_name: "ba.account_holder_name",
        account_number: "ba.account_number",
        account_type: "ba.account_type",
        bank_name: "ba.bank_name",
        ifsc: "ba.ifsc",
        user_type: "ba.user_type",
        bank_account_id: "ba.bank_account_id",
        bank_type: "ba.tag",
        status: "ba.status",
        tag: "ba.tag",
        cheque_image: exports.SQL_BANK_ACCOUNT_CHEQUE_IMAGE("ba"),
        passbook_image: exports.SQL_BANK_ACCOUNT_PASSBOOK_IMAGE("ba"),
        created_at: "ba.created_at",
        updated_at: "ba.updated_at"
    };
    return fieldMap[field] || field;
};

/** Vendor PAN on invoice list/filters: KYC for individual DSA, ru_companies.pan for company DSA. */
exports.SQL_INVOICE_EXPENSE_VENDOR_PAN = `CASE
  WHEN kyc_vendor.dsa_id IS NOT NULL THEN kyc_vendor.permanent_account_number
  WHEN rc.company_id IS NOT NULL THEN rc.pan
  ELSE kyc_exp.permanent_account_number
END`;

/** Vendor name on invoice list/filters: same netsuite_vendor_id individual vs company resolution. */
exports.SQL_INVOICE_EXPENSE_VENDOR_NAME = `CASE
  WHEN kyc_vendor.dsa_id IS NOT NULL THEN d.full_name
  WHEN rc.company_id IS NOT NULL THEN rc.name
  ELSE d.full_name
END`;

exports.SQL_INVOICE_EXPENSE_VENDOR_JOINS = (collateStr = '') => `
LEFT JOIN ru_dsa_kyc_data kyc_vendor ON kyc_vendor.netsuite_vendor_id${collateStr} = e.netsuite_vendor_id${collateStr}
  AND e.netsuite_vendor_id IS NOT NULL AND e.netsuite_vendor_id <> ''
LEFT JOIN ru_companies rc ON rc.ns_internal_id${collateStr} = e.netsuite_vendor_id${collateStr}
  AND e.netsuite_vendor_id IS NOT NULL AND e.netsuite_vendor_id <> ''
  AND kyc_vendor.dsa_id IS NULL
LEFT JOIN ru_direct_selling_agents reg_d ON reg_d.dsa_id${collateStr} = rc.registered_by${collateStr}`;

/** Vendor mobile/email on invoice list: individual DSA vs company's registered-by DSA. */
exports.SQL_INVOICE_EXPENSE_VENDOR_MOBILE = `CASE
  WHEN rc.company_id IS NOT NULL THEN reg_d.dsa_mobile_number
  ELSE d.dsa_mobile_number
END`;

exports.SQL_INVOICE_EXPENSE_VENDOR_EMAIL = `CASE
  WHEN rc.company_id IS NOT NULL THEN reg_d.email_address
  ELSE d.email_address
END`;

exports.getExpensesApiFieldMapping = (field) => {
    const fieldMap = {
        // Expense main fields (aliased as e)
        'memo': 'e.memo',
        'status': `CASE 
                      WHEN e.status = 0 THEN "Approval Pending" 
                      WHEN e.status = 1 THEN "Approved By BH" 
                      WHEN e.status = 2 THEN "Approved By CFO" 
                      ELSE "Rejected" 
                  END`,
        'account': 'e.account',
        'bill_number': 'e.bill_number',
        'category': 'e.category',
        'status_alias': 'e.status_alias',
        'bill_date': 'DATE(e.bill_date)',
        'created_at': 'DATE(e.created_at)',
        'updated_at': 'DATE(e.updated_at)',
        'bill_at_date': 'DATE(e.bill_date)',
        'approved_at': 'DATE(e.approved_at)',
        'created_at_date': 'DATE(e.created_at)',
        'viewed_at': 'DATE(e.viewed_at)',

        // Expense items table fields (aliased as ei)
        'base_amount': 'ei.base_amount',
        'tax_amount': 'ei.tax_amount',
        'amount': 'ei.amount',
        'cgst': 'e.cgst',
        'sgst': 'e.sgst',
        'igst': 'e.igst',

        // DSA fields (aliased as d)
        'dsa_mobile_number': 'd.dsa_mobile_number',
        'dsa_full_name': 'd.full_name',
        'dsa_email_address': 'd.email_address',
        'gstin': 'd.gstin',
        'dsa_name': exports.SQL_INVOICE_EXPENSE_VENDOR_NAME,
        'vendor_name': exports.SQL_INVOICE_EXPENSE_VENDOR_NAME,
        'vendor': exports.SQL_INVOICE_EXPENSE_VENDOR_NAME,


        // Vendor PAN: netsuite_vendor_id → kyc_vendor (individual) or rc (company); fallback kyc_exp
        'dsa_pan': exports.SQL_INVOICE_EXPENSE_VENDOR_PAN,
        'class_id': 'e.class_id',
        'dsa_class': 'kyc_exp.class_id',

        // Created by user (aliased as u)
        // Using CAST with fallback to handle charset mismatches gracefully
        'created_by': `CASE 
                        WHEN e.platform = 'b2b' THEN CAST(COALESCE(du2.full_name, d.full_name) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
                        ELSE CAST(u.name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
                      END`,
        'created_by_id': 'e.created_by', // if needed
        'created_by_name': `CASE 
                             WHEN e.platform = 'b2b' THEN CAST(COALESCE(du2.full_name, d.full_name) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
                             ELSE CAST(u.name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
                           END`,
        // Additional example fields:
        'status_filter': `CASE 
                            WHEN e.status = 0 THEN "Approval Pending" 
                            WHEN e.status = 1 THEN "Approved By BH" 
                            WHEN e.status = 2 THEN "Approved By CFO" 
                            ELSE "Rejected" 
                         END`,
    };

    return fieldMap[field] || field; // fallback to original if no mapping found
};


exports.roleFieldMapping = (field) => {
    const fieldMap = {

    }
    return fieldMap[field] ?? field;
}

exports.getVendorDashboardListApiFieldMapping = (field, isNonDerived = false, key = "vendor_dashboard") => {
    // For non-derived operators (isEmpty, isNotEmpty), use raw field names
    if (isNonDerived) {
        const nonDerivedMap = {
            'partner_name': 'c.partner_code',  // For isEmpty/isNotEmpty, check partner_code
            'vendor_name': 'c.full_name',
            'pan_number': 'k.permanent_account_number',
            'ns_vendor_id': 'k.netsuite_vendor_id',
            'mobile': 'c.dsa_mobile_number',
            'email': 'c.email_address',
            'crm_hierarchy': 'c.hierarchy_crm',
            'ns_hierarchy': 'k.ns_hierarchy',
            'onboarding_percentage': 'onboarding_percentage',  // Calculated field
            'payout_capping': 'c.assigning_payout_percentage',
            'global_payout': 'c.global_payouts_percentage',
            'bank_account': 'bank_account_status',  // Calculated field
            'data_quality_status': 'data_quality_status',  // Calculated field
            'authbridge_pan_verification_status': 'k.is_permanent_account_number_verified'
        };
        return nonDerivedMap[field] || field;
    }

    // For derived operators, use mapped database fields
    const fieldMap = {
        'vendor_name': 'c.full_name',
        'partner_name': 'p.full_name',  // From JOIN with partner table
        'pan_number': 'k.permanent_account_number',
        'ns_vendor_id': 'k.netsuite_vendor_id',
        'mobile': 'c.dsa_mobile_number',
        'email': 'c.email_address',
        'crm_hierarchy': 'c.hierarchy_crm',
        'ns_hierarchy': 'k.ns_hierarchy',
        'onboarding_percentage': `(
            SELECT CASE 
                WHEN total_possible_steps > 0 
                THEN (completed_steps * 100.0 / total_possible_steps)
                ELSE 0 
            END
            FROM (
                SELECT 
                    COUNT(DISTINCT CASE 
                        WHEN o.dsa_type = 'individual'
                        AND o.step IN ('lead_generation', 'dsa_consent', 'basic_details', 'address', 'kyc', 'dsa_agreement')
                        THEN o.step 
                    END) as total_possible_steps,
                    COUNT(DISTINCT CASE 
                        WHEN s.status = 1
                        AND o.dsa_type = 'individual'
                        AND o.step IN ('lead_generation', 'dsa_consent', 'basic_details', 'address', 'kyc', 'dsa_agreement')
                        THEN s.step 
                    END) as completed_steps
                FROM ru_onboarding_steps o
                LEFT JOIN ru_user_onboarding_steps s ON s.dsa_id = c.dsa_id AND s.step = o.step
                WHERE o.step IN ('lead_generation', 'dsa_consent', 'basic_details', 'address', 'kyc', 'dsa_agreement')
                AND o.dsa_type = 'individual'
            ) step_calc
        )`,
        'payout_capping': `CASE 
            WHEN (c.assigning_payout_percentage IS NOT NULL AND c.assigning_payout_percentage != '')
            THEN 'Set'
            ELSE 'Missing'
        END`,
        'global_payout': `CASE 
            WHEN (c.global_payouts_percentage IS NOT NULL AND c.global_payouts_percentage != '')
            THEN 'Set'
            ELSE 'Missing'
        END`,
        'bank_account': `CASE 
            WHEN EXISTS (
                SELECT 1 FROM ru_dsa_bank_accounts ba 
                WHERE ba.dsa_id = c.dsa_id 
                AND ba.account_number IS NOT NULL 
                AND ba.account_number != ''
            )
            THEN 'Added'
            ELSE 'Missing'
        END`,
        'authbridge_pan_verification_status': 'k.is_permanent_account_number_verified',
        'data_quality_status': `CASE 
            WHEN (
                c.dsa_mobile_number REGEXP '^[0-9]{10}$' = 0 
                OR c.email_address REGEXP '^[^@]+@[^@]+\\\\.[^@]+$' = 0
                OR (k.permanent_account_number IS NULL OR k.permanent_account_number = '' OR (
                    k.permanent_account_number NOT LIKE '%X%'
                    AND k.permanent_account_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$' = 0
                    AND k.permanent_account_number REGEXP '^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$' = 0
                    AND k.permanent_account_number REGEXP '^[A-Z]{3}[CFHATBLJGP][A-Z][0-9]{4}[A-Z]$' = 0
                ))
                OR (c.global_payouts_percentage IS NULL OR c.global_payouts_percentage = '')
                OR (c.assigning_payout_percentage IS NULL OR c.assigning_payout_percentage = '')
                OR NOT EXISTS (
                    SELECT 1 FROM ru_dsa_bank_accounts ba 
                    WHERE ba.dsa_id = c.dsa_id 
                    AND ba.account_number IS NOT NULL 
                    AND ba.account_number != ''
                )
                OR (k.ns_hierarchy IS NULL OR k.ns_hierarchy = '' OR k.netsuite_vendor_id IS NULL OR k.netsuite_vendor_id = '')
            )
            THEN 'Issues'
            ELSE 'OK'
        END`
    };

    return fieldMap[field] || field;
}

/**
 * Field mapping for vendor hierarchy compact search (vendor_hierarchy_snapshot, alias h).
 * Used with filterModel in getVendorHierarchyCompactSearch; hierarchy is applied separately.
 */
/** MUI X filterModel fields for getVendorBranchList (aggregated branch rows). */
exports.getVendorBranchListApiFieldMapping = (field, isNonDerived = false, key = 'vendor_branch_list') => {
    if (isNonDerived) {
        const nonDerivedMap = {
            branch_code: 'branch_agg.branch_code',
            branch_name: 'branch_agg.branch_name',
            total_dsa: 'branch_agg.total_dsa'
        };
        return nonDerivedMap[field] || field;
    }
    const fieldMap = {
        branch_code: 'branch_agg.branch_code',
        branch_name: 'branch_agg.branch_name',
        total_dsa: 'branch_agg.total_dsa'
    };
    return fieldMap[field] || field;
};

exports.getCompactSearchFieldMapping = (field, isNonDerived = false, key = 'compact_search') => {
    const fieldMap = {
        full_name: 'h.full_name',
        dsa_id: 'h.dsa_id',
        parent_dsa_id: 'h.parent_dsa_id',
        level_depth: 'h.level_depth',
        subtree_any_issue_count: 'h.subtree_any_issue_count',
        subtree_total_count: 'h.subtree_total_count',
        subtree_junk_contact_count: 'h.subtree_junk_contact_count',
        subtree_bank_missing_count: 'h.subtree_bank_missing_count',
        subtree_global_payout_missing_count: 'h.subtree_global_payout_missing_count',
        subtree_ns_missing_count: 'h.subtree_ns_missing_count',
        subtree_onboarding_incomplete_count: 'h.subtree_onboarding_incomplete_count'
    };
    return fieldMap[field] || field;
};

const LEAD_FORMS_IS_SAME_DAY_BILLING_ENABLED_SQL =
    '(case when flc.user_type = \'company\' then cdsa.is_same_day_billing_enabled else d.is_same_day_billing_enabled end)';
exports.LEAD_FORMS_IS_SAME_DAY_BILLING_ENABLED_SQL = LEAD_FORMS_IS_SAME_DAY_BILLING_ENABLED_SQL;

exports.getLeadFormsFieldMapping = (field) => {
    const fieldMap = {
        'created_at': 'flc.created_at',
        'updated_at': 'DATE(flc.updated_at)',
        'customer_full_name': 'flc.customer_full_name',
        'bank_name': 'flc.bank_name',
        'product_name': 'flc.product_name',
        'disbursement_amount': 'flc.disbursement_amount',
        'dsa_mobile_number': 'flc.dsa_mobile_number',
        'status': 'flc.fresh_lead_status_id',
        /* 'partner_name': 'p.full_name', */
        'dsa_name': `case when flc.user_type = 'company' then rc.name else d.full_name end`,
        /* 'city': 'flc.city', */
        'claim_month': 'flc.claim_month',
        'loan_reference_id': 'flc.loan_reference_id',
        'netsuite_vendor_claim_file_internal_id': 'flc.netsuite_vendor_claim_file_internal_id',
        'loan_apac_ref_los_number': 'flc.loan_apac_ref_los_number',
        'disbursement_date_iso': 'flc.disbursement_date_iso',
        /* 'netsuite_bank_id': 'flc.netsuite_bank_id',
        'netsuite_product_id': 'flc.netsuite_product_id', */
        'vendor_payout_rate': 'flc.vendor_payout_rate',
        'vendor_payout_ratio': 'flc.vendor_payout_ratio',
        'vendor_payout_type': 'flc.vendor_payout_type',
        'vendor_payout_amount': 'flc.vendor_payout_amount',
        /* 'payout_collide': `case when flc.payout_collide = 0 then "no" else "yes" end`, */
        'is_split_case': 'flc.is_split_case',
        /* 'class_id': 'flc.class_id', */
        'current_hierarchy_crm': 'flc.current_hierarchy_crm',
        /* 'business_head_name': `case when flc.user_type = 'company' then cbh.full_name else bh.full_name end`, */
        'dsa_pan': `case when flc.user_type = 'company' then rc.pan else kyc.permanent_account_number end`,
        /* 'customer_pan': 'c.permanent_account_number',
        'remark_description': 'r.remark_description', */
        /* 'customer_company_name': 'flc.customer_company_name', */
        'fresh_lead_id': 'flc.fresh_lead_id',
        'upload_file_name': `case when flc.upload_file_name is null then "Self" else flc.upload_file_name end`,
        /* 'created_by': 'flc.created_by', */
        'is_tentative_matched': 'flcm.is_tentative_matched',
        'bank_file_matched': 'flcm.is_bank_file_matched',
        'is_online_lead': 'flcm.is_online_lead',
        'user_remark': 'flc.user_remark',
        /* 'loan_type': 'flc.loan_type',
        'pf_collected': 'flc.pf_collected',
        'loan_status': 'flc.loan_status', */
        'reject_reason': 'flc.reject_reason',
        'platform': 'flc.platform',
        'form_type': 'flc.form_type',
        'is_same_day_billing_enabled': LEAD_FORMS_IS_SAME_DAY_BILLING_ENABLED_SQL,
        'same_day_billing': 'flc.same_day_billing'
        /* , 'ns_contest_id': 'flc.ns_contest_id' */
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for ru_netsuite_banks (getNetsuiteBankList). */
exports.getNetsuiteBankListFieldMapping = (field) => {
    const fieldMap = {
        id: 'nb.id',
        bank_name: 'nb.bank_name',
        netsuite_bank_id: 'nb.netsuite_bank_id',
        status: 'nb.status',
        grade: 'nb.grade',
        pan: 'nb.pan',
        registered_on_company_name: 'nb.registered_on_company_name',
        external_id: 'nb.external_id',
        remarks: 'nb.remarks',
        created_at: 'DATE(nb.created_at)',
        updated_at: 'DATE(nb.updated_at)',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for ru_netsuite_products (getNetsuiteProductList). */
exports.getNetsuiteProductListFieldMapping = (field) => {
    const fieldMap = {
        netsuite_product_id: 'p.netsuite_product_id',
        product_name: 'p.product_name',
        main_product: 'p.main_product',
        short_name: 'p.short_name',
        remarks: 'p.remarks',
        category: 'p.category',
        status: 'p.status',
        created_at: 'DATE(p.created_at)',
        updated_at: 'DATE(p.updated_at)',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for getApplicationsByProductAndLoanType. */
exports.getApplicationsByProductAndLoanTypeFieldMapping = (field) => {
    const fieldMap = {
        application_id: 'pl.application_id',
        external_id: 'pl.external_id',
        status: 'pl.status',
        stage: 'pl.stage',
        sub_stage: 'pl.sub_stage',
        sub_status: 'pl.sub_status',
        status_description: 'pl.status_description',
        applied_loan_amount: 'pl.applied_loan_amount',
        approved_loan_amount: 'pl.approved_loan_amount',
        disbursed_loan_amount: 'pl.disbursed_loan_amount',
        loan_tenure: 'pl.loan_tenure',
        claim_status: 'pl.claim_status',
        loan_apac_ref_los_number: 'pl.loan_apac_ref_los_number',
        loan_reference_id: 'pl.loan_reference_id',
        application_ref: 'pl.application_ref',
        created_at: 'DATE(pl.created_at)',
        updated_at: 'DATE(pl.updated_at)',
        customer_full_name: 'c.full_name',
        customer_mobile_number: 'c.customer_mobile_number',
        customer_email: 'c.email_address',
        permanent_account_number: 'c.permanent_account_number',
        partner_name: 'd.full_name',
        partner_mobile: 'd.dsa_mobile_number',
        hierarchy_crm: 'd.hierarchy_crm',
        bh_name: 'bh.full_name',
        sp_name: 'rm.sp_name',
        sp_email: 'rm.sp_email',
        sp_mobile: 'rm.sp_mobile',
        disbursed_date: 'DATE(plm.disbursed_date)',
        offered_loan_tenure: 'plm.offered_loan_tenure',
        city: 'rca.city',
        pin_code: 'rca.pin_code',
        ifsc_code: 'bank.ifsc_code',
        branch_name: 'bank.branch_name',
        utm_source: 'utm.utm_source',
        utm_medium: 'utm.utm_medium',
        utm_campaign: 'utm.utm_campaign',
        utm_content: 'utm.utm_content',
        utm_channel: 'utm.utm_channel',
        utm_term: 'utm.utm_term',
        utm_id: 'utm.utm_id',
        utm_adgroup: 'utm.utm_adgroup',
        utm_main_source: 'utm.utm_main_source',
        utm_device: 'utm.utm_device',
        source_from: 'utm.source_from',
        page_source: 'utm.page_source',
        ad_group_id: 'utm.adgroupid',
        campaign_id: 'utm.campaignid',
        ad: 'utm.ad',
        mt: 'utm.mt',
        adpos: 'utm.adpos',
        gad: 'utm.gad',
        gclid: 'utm.gclid',
        fbclid: 'utm.fbclid',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column for ru_bank_product_combinations (getAllBankProductCombination). */
exports.getAllBankProductCombinationFieldMapping = (field) => {
    const fieldMap = {
        id: 'bpc.id',
        login_code: 'd.login_code',
        max_payout_capping: 'bpc.max_payout_capping',
        autonomous_payout_capping: 'bpc.autonomous_payout_capping',
        avg_achievment: 'd.avg_achievment',
        bank_product_status: 'bpc.status',
        netsuite_bank_id: 'nb.netsuite_bank_id',
        bank_name: 'nb.bank_name',
        bank_status: 'nb.status',
        netsuite_product_id: 'np.netsuite_product_id',
        product_name: 'np.product_name',
        main_product: 'np.main_product',
        short_name: 'np.short_name',
        remarks: 'np.remarks',
        category: 'np.category',
        product_status: 'np.status',
        b2b_login_enable: 'bpc.b2b_login_enable',
        login_link: 'bpc.login_link',
        bank_logo: 'bpc.bank_logo',
        gro_name: 'bpc.gro_name',
        status: 'CASE WHEN np.status = 0 OR nb.status = 0 OR bpc.status = 0 THEN 0 ELSE 1 END',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column mapping for bank_details (getAllBanks). */
exports.getBankDetailsFieldMapping = (field) => {
    const fieldMap = {
        id: 'id',
        bank_nbfc_name: 'bank_nbfc_name',
        product: 'product',
        state: 'state',
        city: 'city',
        company: 'company',
        market_and_sub_type: 'market_and_sub_type',
        login_code: 'login_code',
        createdAt: 'DATE(createdAt)',
        updatedAt: 'DATE(updatedAt)',
    };
    return fieldMap[field] || field;
};
/** MUI X filterModel field → SQL column for payouts table (getAllPayouts). */
exports.getGlobalPayoutsFieldMapping = (field) => {
    const fieldMap = {
        id: 'p.id',
        bank_name: 'p.bank_name',
        bank_id: 'p.bank_id',
        product_id: 'p.product_id',
        product: 'p.product',
        main_product: 'p.main_product',
        sub_product: 'p.sub_product',
        product_group: 'p.product_group',
        login_code: 'p.login_code',
        type: 'p.type',
        avg_achievement: 'p.avg_achievment',
        avg_achievment: 'p.avg_achievment',
        enrollment_date: 'DATE(p.enrollment_date)',
        created_at: 'DATE(p.created_at)',
        status: 'p.status',
        registered_on_company_name: 'p.registered_on_company_name',
        address: 'p.address',
        type_of_payout: 'p.type_of_payout',
        company_category: 'p.company_category',
        remarks: 'p.remarks',
    };
    return fieldMap[field] || field;
};

/** MUI X filterModel field → SQL column mapping for ru_companies (getAllCompany). */
exports.getAllCompanyFieldMapping = (field) => {
    const latestAddressSubquery = (column) =>
        `(SELECT ${column} FROM ru_company_addresses WHERE company_id = ru_companies.company_id ORDER BY created_at DESC LIMIT 1)`;
    const fieldMap = {
        id: 'ru_companies.id',
        company_id: 'ru_companies.company_id',
        name: 'ru_companies.name',
        short_name: 'ru_companies.short_name',
        pan: 'ru_companies.pan',
        phone: 'ru_companies.phone',
        business_type: 'ru_companies.business_type',
        date_of_incorp: 'ru_companies.date_of_incorp',
        gstin: 'ru_companies.gstin',
        msme_no: 'ru_companies.msme_no',
        registered_by: 'ru_companies.registered_by',
        is_pan_verified: 'ru_companies.is_pan_verified',
        ns_internal_id: 'ru_companies.ns_internal_id',
        created_at: 'DATE(ru_companies.created_at)',
        updated_at: 'DATE(ru_companies.updated_at)',
        city: latestAddressSubquery('city'),
        state: latestAddressSubquery('state'),
        country: latestAddressSubquery('country'),
        pin_code: latestAddressSubquery('pin_code'),
    };
    return fieldMap[field] || field;
};
