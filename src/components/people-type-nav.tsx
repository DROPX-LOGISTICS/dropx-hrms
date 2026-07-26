import Link from "next/link";

export function PeopleTypeNav({ active }: { active: "employees" | "contractors" }) {
  return <nav className="people-type-nav" aria-label="People types">
    <Link className={active === "employees" ? "active" : ""} href="/people">Employees</Link>
    <Link className={active === "contractors" ? "active" : ""} href="/people/contractors">Independent Contractors</Link>
  </nav>;
}
