-- Migration file: create_payroll_heads_for_all_companies.sql
-- Purpose: Create all necessary payroll heads for ALL companies
-- Created: 2026-07-29
-- Updated: 2026-07-30 - Added Employee Deductions
-- This will run for all companies in the system

-- Start transaction for atomicity
BEGIN;

-- =============================================
-- CTC COMPONENT - Add if not exists, skip if exists
-- Valid head_type: 'ctc', is_system: true
-- =============================================

INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'CTC' as code,
    'Cost to the Company' as name,
    'ctc' as head_type,
    true as is_system,
    1 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'CTC'
);

-- =============================================
-- EMPLOYEE EARNINGS (All Earning Components)
-- Valid head_type: 'employee_earning'
-- =============================================

-- 1. Basic Salary
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'BASIC_SALARY' as code,
    'Basic Salary' as name,
    'employee_earning' as head_type,
    false as is_system,
    10 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'BASIC_SALARY'
);

-- 2. House Rent Allowance (HRA)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'HRA' as code,
    'House Rent Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    20 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'HRA'
);

-- 3. Conveyance Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'CONVEYANCE_ALLOWANCE' as code,
    'Conveyance Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    30 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'CONVEYANCE_ALLOWANCE'
);

-- 4. Special Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'SPECIAL_ALLOWANCE' as code,
    'Special Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    40 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'SPECIAL_ALLOWANCE'
);

-- 5. Other Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'OTHER_ALLOWANCE' as code,
    'Other Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    50 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'OTHER_ALLOWANCE'
);

-- 6. Leave Travel Allowance (LTA)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'LTA' as code,
    'Leave Travel Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    60 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'LTA'
);

-- 7. Bonus
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'BONUS' as code,
    'Bonus' as name,
    'employee_earning' as head_type,
    false as is_system,
    70 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'BONUS'
);

-- 8. NFH Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'NFH_ALLOWANCE' as code,
    'NFH Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    80 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'NFH_ALLOWANCE'
);

-- 9. Omni Incentive
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'OMNI_INCENTIVE' as code,
    'Omni Incentive' as name,
    'employee_earning' as head_type,
    false as is_system,
    90 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'OMNI_INCENTIVE'
);

-- 10. Driver Allowance (Logistics Specific)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'DRIVER_ALLOWANCE' as code,
    'Driver Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    100 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'DRIVER_ALLOWANCE'
);

-- 11. Fuel Allowance (Logistics Specific)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'FUEL_ALLOWANCE' as code,
    'Fuel Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    110 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'FUEL_ALLOWANCE'
);

-- 12. Travel Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'TRAVEL_ALLOWANCE' as code,
    'Travel Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    120 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'TRAVEL_ALLOWANCE'
);

-- 13. Performance Incentive
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'PERFORMANCE_INCENTIVE' as code,
    'Performance Incentive' as name,
    'employee_earning' as head_type,
    false as is_system,
    130 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'PERFORMANCE_INCENTIVE'
);

-- 14. Night Shift Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'NIGHT_SHIFT_ALLOWANCE' as code,
    'Night Shift Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    140 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'NIGHT_SHIFT_ALLOWANCE'
);

-- 15. Overtime Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'OVERTIME_ALLOWANCE' as code,
    'Overtime Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    150 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'OVERTIME_ALLOWANCE'
);

-- 16. Medical Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'MEDICAL_ALLOWANCE' as code,
    'Medical Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    160 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'MEDICAL_ALLOWANCE'
);

-- 17. Education Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'EDUCATION_ALLOWANCE' as code,
    'Education Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    170 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'EDUCATION_ALLOWANCE'
);

-- 18. Children Education Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'CHILDREN_EDUCATION_ALLOWANCE' as code,
    'Children Education Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    180 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'CHILDREN_EDUCATION_ALLOWANCE'
);

-- 19. Dearness Allowance (DA)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'DEARNESS_ALLOWANCE' as code,
    'Dearness Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    190 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'DEARNESS_ALLOWANCE'
);

-- 20. City Compensatory Allowance (CCA)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'CITY_COMPENSATORY_ALLOWANCE' as code,
    'City Compensatory Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    200 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'CITY_COMPENSATORY_ALLOWANCE'
);

-- 21. Communication Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'COMMUNICATION_ALLOWANCE' as code,
    'Communication Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    210 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'COMMUNICATION_ALLOWANCE'
);

-- 22. Uniform Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'UNIFORM_ALLOWANCE' as code,
    'Uniform Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    220 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'UNIFORM_ALLOWANCE'
);

-- 23. Meal Allowance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'MEAL_ALLOWANCE' as code,
    'Meal Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    230 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'MEAL_ALLOWANCE'
);

-- 24. Vehicle Maintenance Allowance (Logistics)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'VEHICLE_MAINTENANCE_ALLOWANCE' as code,
    'Vehicle Maintenance Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    240 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'VEHICLE_MAINTENANCE_ALLOWANCE'
);

-- 25. Toll/Parking Allowance (Logistics)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'TOLL_PARKING_ALLOWANCE' as code,
    'Toll/Parking Allowance' as name,
    'employee_earning' as head_type,
    false as is_system,
    250 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'TOLL_PARKING_ALLOWANCE'
);

-- 26. Earning Arrear
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'EARNING_ARREAR' as code,
    'Earning Arrear' as name,
    'employee_earning' as head_type,
    false as is_system,
    260 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'EARNING_ARREAR'
);

-- 27. Paid Arrear
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'PAID_ARREAR' as code,
    'Paid Arrear' as name,
    'employee_earning' as head_type,
    false as is_system,
    270 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'PAID_ARREAR'
);

-- 28. Travel Reimbursement (as employee earning)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'TRAVEL_REIMBURSEMENT' as code,
    'Travel Reimbursement' as name,
    'employee_earning' as head_type,
    false as is_system,
    280 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'TRAVEL_REIMBURSEMENT'
);

-- 29. Mobile Reimbursement (as employee earning)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'MOBILE_REIMBURSEMENT' as code,
    'Mobile Reimbursement' as name,
    'employee_earning' as head_type,
    false as is_system,
    290 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'MOBILE_REIMBURSEMENT'
);

-- 30. Food/Coupon Reimbursement (as employee earning)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'FOOD_REIMBURSEMENT' as code,
    'Food/Coupon Reimbursement' as name,
    'employee_earning' as head_type,
    false as is_system,
    300 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'FOOD_REIMBURSEMENT'
);

-- 31. Incentive (General)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'INCENTIVE' as code,
    'Incentive' as name,
    'employee_earning' as head_type,
    false as is_system,
    310 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'INCENTIVE'
);

-- =============================================
-- EMPLOYEE DEDUCTIONS (Company-defined deductions)
-- Valid head_type: 'employee_deduction'
-- =============================================

-- 32. Employee Loan Deduction
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'EMPLOYEE_LOAN' as code,
    'Employee Loan' as name,
    'employee_deduction' as head_type,
    false as is_system,
    10 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'EMPLOYEE_LOAN'
);

-- 33. Vehicle Loan Deduction
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'VEHICLE_LOAN_DEDUCTION' as code,
    'Vehicle Loan Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    20 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'VEHICLE_LOAN_DEDUCTION'
);

-- 34. Housing Loan Deduction
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'HOUSING_LOAN_DEDUCTION' as code,
    'Housing Loan Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    30 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'HOUSING_LOAN_DEDUCTION'
);

-- 35. Advance Salary Deduction
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'ADVANCE_SALARY_DEDUCTION' as code,
    'Advance Salary Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    40 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'ADVANCE_SALARY_DEDUCTION'
);

-- 36. Insurance Premium Deduction
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'INSURANCE_PREMIUM_DEDUCTION' as code,
    'Insurance Premium Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    50 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'INSURANCE_PREMIUM_DEDUCTION'
);

-- 37. Union Subscription
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'UNION_SUBSCRIPTION_DEDUCTION' as code,
    'Union Subscription' as name,
    'employee_deduction' as head_type,
    false as is_system,
    60 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'UNION_SUBSCRIPTION_DEDUCTION'
);

-- 38. Staff Welfare Fund
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'STAFF_WELFARE_DEDUCTION' as code,
    'Staff Welfare Fund' as name,
    'employee_deduction' as head_type,
    false as is_system,
    70 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'STAFF_WELFARE_DEDUCTION'
);

-- 39. Meal Deduction (Company cafeteria/meal charges)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'MEAL_DEDUCTION' as code,
    'Meal Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    80 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'MEAL_DEDUCTION'
);

-- 40. Transportation Deduction (Company transport facility charges)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'TRANSPORT_DEDUCTION' as code,
    'Transport Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    90 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'TRANSPORT_DEDUCTION'
);

-- 41. Mobile Bill Deduction
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'MOBILE_BILL_DEDUCTION' as code,
    'Mobile Bill Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    100 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'MOBILE_BILL_DEDUCTION'
);

-- 42. Rent Deduction (Company-provided housing)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'RENT_DEDUCTION' as code,
    'Rent Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    110 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'RENT_DEDUCTION'
);

-- 43. Salary Advance Repayment
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'SALARY_ADVANCE_REPAYMENT' as code,
    'Salary Advance Repayment' as name,
    'employee_deduction' as head_type,
    false as is_system,
    120 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'SALARY_ADVANCE_REPAYMENT'
);

-- 44. Education Fee Deduction (For employee children education)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'EDUCATION_FEE_DEDUCTION' as code,
    'Education Fee Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    130 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'EDUCATION_FEE_DEDUCTION'
);

-- 45. Charitable Contributions
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'CHARITABLE_CONTRIBUTION' as code,
    'Charitable Contribution' as name,
    'employee_deduction' as head_type,
    false as is_system,
    140 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'CHARITABLE_CONTRIBUTION'
);

-- 46. Reimbursement Recovery (Recovery of overpaid reimbursements)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'REIMBURSEMENT_RECOVERY' as code,
    'Reimbursement Recovery' as name,
    'employee_deduction' as head_type,
    false as is_system,
    150 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'REIMBURSEMENT_RECOVERY'
);

-- 47. Other Employee Deductions
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'OTHER_EMPLOYEE_DEDUCTION' as code,
    'Other Employee Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    160 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'OTHER_EMPLOYEE_DEDUCTION'
);

-- 48. Court Order Deduction (Garnishment)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'COURT_ORDER_DEDUCTION' as code,
    'Court Order Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    170 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'COURT_ORDER_DEDUCTION'
);

-- 49. Penalty/Fine Deduction
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'PENALTY_DEDUCTION' as code,
    'Penalty/Fine Deduction' as name,
    'employee_deduction' as head_type,
    false as is_system,
    180 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'PENALTY_DEDUCTION'
);

-- =============================================
-- STATUTORY DEDUCTIONS
-- Valid head_type: 'statutory_deduction'
-- =============================================

-- 50. Employee PF
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'EPF_D' as code,
    'Employee PF' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    10 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'EPF_D'
);

-- 51. Employee ESI
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'ESI_D' as code,
    'Employee ESI' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    20 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'ESI_D'
);

-- 52. Profession Tax
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'PROFESSION_TAX' as code,
    'Profession Tax' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    30 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'PROFESSION_TAX'
);

-- 53. Income Tax (TDS)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'INCOME_TAX' as code,
    'Income Tax (TDS)' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    40 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'INCOME_TAX'
);

-- 54. Labour Welfare Fund
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'LABOUR_WELFARE_FUND' as code,
    'Labour Welfare Fund' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    50 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'LABOUR_WELFARE_FUND'
);

-- 55. Deduction Arrear
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'DEDUCTION_ARREAR' as code,
    'Deduction Arrear' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    60 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'DEDUCTION_ARREAR'
);

-- 56. Insurance Premium
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'INSURANCE_PREMIUM' as code,
    'Insurance Premium' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    70 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'INSURANCE_PREMIUM'
);

-- 57. Loan Repayment
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'LOAN_REPAYMENT' as code,
    'Loan Repayment' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    80 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'LOAN_REPAYMENT'
);

-- 58. Advance Salary
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'ADVANCE_SALARY' as code,
    'Advance Salary' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    90 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'ADVANCE_SALARY'
);

-- 59. Union Subscription
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'UNION_SUBSCRIPTION' as code,
    'Union Subscription' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    100 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'UNION_SUBSCRIPTION'
);

-- 60. Staff Welfare Fund
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'STAFF_WELFARE_FUND' as code,
    'Staff Welfare Fund' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    110 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'STAFF_WELFARE_FUND'
);

-- 61. Housing Loan
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'HOUSING_LOAN' as code,
    'Housing Loan' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    120 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'HOUSING_LOAN'
);

-- 62. Vehicle Loan
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'VEHICLE_LOAN' as code,
    'Vehicle Loan' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    130 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'VEHICLE_LOAN'
);

-- 63. Salary Advance
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'SALARY_ADVANCE' as code,
    'Salary Advance' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    140 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'SALARY_ADVANCE'
);

-- 64. Other Deductions
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'OTHER_DEDUCTIONS' as code,
    'Other Deductions' as name,
    'statutory_deduction' as head_type,
    false as is_system,
    150 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'OTHER_DEDUCTIONS'
);

-- =============================================
-- STATUTORY CONTRIBUTIONS (Employer)
-- Valid head_type: 'statutory_contribution'
-- =============================================

-- 65. Employer PF
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'EPF_C' as code,
    'Employer PF' as name,
    'statutory_contribution' as head_type,
    false as is_system,
    10 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'EPF_C'
);

-- 66. Employer ESI
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'ESI_C' as code,
    'Employer ESI' as name,
    'statutory_contribution' as head_type,
    false as is_system,
    20 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'ESI_C'
);

-- 67. Employer Pension Fund (EPS)
INSERT INTO hr_payroll_heads (
    id, company_id, code, name, head_type, is_system, display_order, is_active, created_by, created_at, updated_at
)
SELECT 
    gen_random_uuid() as id,
    c.id as company_id,
    'EPS_C' as code,
    'Employer Pension Fund' as name,
    'statutory_contribution' as head_type,
    false as is_system,
    30 as display_order,
    true as is_active,
    NULL as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM hr_payroll_heads h 
    WHERE h.company_id = c.id 
    AND h.code = 'EPS_C'
);

-- =============================================
-- VERIFICATION - Summary of all head types per company
-- =============================================
SELECT 
    h.company_id,
    c.name as company_name,
    COUNT(CASE WHEN h.head_type = 'employee_earning' THEN 1 END) as earnings,
    COUNT(CASE WHEN h.head_type = 'employee_deduction' THEN 1 END) as employee_deductions,
    COUNT(CASE WHEN h.head_type = 'statutory_deduction' THEN 1 END) as statutory_deductions,
    COUNT(CASE WHEN h.head_type = 'statutory_contribution' THEN 1 END) as statutory_contributions,
    COUNT(CASE WHEN h.head_type = 'ctc' THEN 1 END) as ctc_heads,
    COUNT(*) as total_heads,
    COUNT(CASE WHEN h.is_system = true THEN 1 END) as system_heads,
    COUNT(CASE WHEN h.is_system = false THEN 1 END) as custom_heads
FROM hr_payroll_heads h
JOIN companies c ON c.id = h.company_id
GROUP BY h.company_id, c.name
ORDER BY c.name;

-- =============================================
-- VERIFICATION - List all employee deductions
-- =============================================
SELECT 
    h.company_id,
    c.name as company_name,
    h.code,
    h.name,
    h.is_active,
    h.display_order
FROM hr_payroll_heads h
JOIN companies c ON c.id = h.company_id
WHERE h.head_type = 'employee_deduction'
ORDER BY c.name, h.display_order;

-- Commit transaction
COMMIT;

-- Rollback in case of error (uncomment if needed)
-- ROLLBACK;