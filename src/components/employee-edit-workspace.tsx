"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { BadgeIndianRupee, UserRound } from "lucide-react";
import { EmployeeEditForm } from "@/components/employee-edit-form";
import { EmployeeSalaryConfigurationForm } from "@/components/employee-salary-configuration-form";

type EmployeeEditWorkspaceProps = {
  initialSection?: "details" | "salary";
  employeeAction: ComponentProps<typeof EmployeeEditForm>["action"];
  employee: ComponentProps<typeof EmployeeEditForm>["employee"];
  locations: ComponentProps<typeof EmployeeEditForm>["locations"];
  designations: ComponentProps<typeof EmployeeEditForm>["designations"];
  rules: ComponentProps<typeof EmployeeEditForm>["rules"];
  salaryAction: ComponentProps<typeof EmployeeSalaryConfigurationForm>["action"];
  assignment: ComponentProps<typeof EmployeeSalaryConfigurationForm>["assignment"];
  configurations: ComponentProps<typeof EmployeeSalaryConfigurationForm>["configurations"];
};

export function EmployeeEditWorkspace({
  initialSection = "details",
  employeeAction,
  employee,
  locations,
  designations,
  rules,
  salaryAction,
  assignment,
  configurations
}: EmployeeEditWorkspaceProps) {
  const [section, setSection] = useState(initialSection);

  return <>
    <div className="employee-edit-tabs" role="tablist" aria-label="Employee edit sections">
      <button
        id="employee-details-tab"
        className={`employee-edit-tab${section === "details" ? " active" : ""}`}
        type="button"
        role="tab"
        aria-selected={section === "details"}
        aria-controls="employee-details-panel"
        onClick={() => setSection("details")}
      >
        <UserRound size={15} />
        Employee details
      </button>
      <button
        id="employee-salary-tab"
        className={`employee-edit-tab${section === "salary" ? " active" : ""}`}
        type="button"
        role="tab"
        aria-selected={section === "salary"}
        aria-controls="employee-salary-panel"
        onClick={() => setSection("salary")}
      >
        <BadgeIndianRupee size={15} />
        Salary configuration
      </button>
    </div>

    {section === "details" ? <div
      id="employee-details-panel"
      className="employee-edit-tabpanel"
      role="tabpanel"
      aria-labelledby="employee-details-tab"
    >
      <EmployeeEditForm
        action={employeeAction}
        employee={employee}
        locations={locations}
        designations={designations}
        rules={rules}
      />
    </div> : <div
      id="employee-salary-panel"
      className="employee-edit-tabpanel"
      role="tabpanel"
      aria-labelledby="employee-salary-tab"
    >
      <EmployeeSalaryConfigurationForm
        action={salaryAction}
        assignment={assignment}
        configurations={configurations}
        employeeDateOfJoin={employee.date_of_join}
        employeeId={employee.id}
      />
    </div>}
  </>;
}
