"""Budget data validator for checking data quality."""

from ..models.schema import BudgetData


class BudgetValidator:
    """Validator for budget data quality checks.

    Performs hierarchical sum validation, cross-year consistency checks,
    and ID uniqueness validation.
    """

    def __init__(self, tolerance: float = 1.0) -> None:
        """Initialize validator.

        Args:
            tolerance: Dollar tolerance for sum mismatches (default $1 for rounding)
        """
        self.tolerance = tolerance
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def validate(self, data: BudgetData, prior_data: BudgetData | None = None) -> bool:
        """Validate budget data.

        Args:
            data: BudgetData to validate
            prior_data: Optional prior year data for cross-year checks

        Returns:
            True if validation passes, False if errors found
        """
        self.errors = []
        self.warnings = []

        # 1. Schema validation (already done by Pydantic)

        # 2. Hierarchical sum validation
        self._validate_department_sums(data)
        self._validate_subcategory_sums(data)
        self._validate_fund_breakdown_sums(data)
        self._validate_fund_summary_sum(data)

        # 3. ID uniqueness
        self._validate_unique_ids(data)

        # 4. Revenue validation (if revenue data present)
        self._validate_revenue(data)

        # 5. Cross-year consistency (if prior data provided)
        if prior_data is not None:
            self._validate_cross_year_consistency(data, prior_data)

        return len(self.errors) == 0

    def _validate_department_sums(self, data: BudgetData) -> None:
        """Check that sum of departments equals total appropriations."""
        dept_sum = sum(d.amount for d in data.appropriations.by_department)
        total = data.metadata.total_appropriations

        if abs(dept_sum - total) > self.tolerance:
            self.errors.append(
                f"Department sum (${dept_sum:,}) does not match total appropriations "
                f"(${total:,}). Difference: ${abs(dept_sum - total):,}"
            )

    def _validate_subcategory_sums(self, data: BudgetData) -> None:
        """Check that subcategories sum to department amount for each department."""
        for dept in data.appropriations.by_department:
            if dept.subcategories:
                subcat_sum = sum(s.amount for s in dept.subcategories)
                if abs(subcat_sum - dept.amount) > self.tolerance:
                    self.errors.append(
                        f"Subcategory sum (${subcat_sum:,}) does not match department amount "
                        f"(${dept.amount:,}) for {dept.name}. "
                        f"Difference: ${abs(subcat_sum - dept.amount):,}"
                    )

    def _validate_fund_breakdown_sums(self, data: BudgetData) -> None:
        """Check that fund breakdown sums to department amount (warning, not error)."""
        for dept in data.appropriations.by_department:
            if dept.fund_breakdown:
                fund_sum = sum(f.amount for f in dept.fund_breakdown)
                if abs(fund_sum - dept.amount) > self.tolerance:
                    self.warnings.append(
                        f"Fund breakdown sum (${fund_sum:,}) does not match department amount "
                        f"(${dept.amount:,}) for {dept.name}. "
                        f"Difference: ${abs(fund_sum - dept.amount):,}"
                    )

    def _validate_fund_summary_sum(self, data: BudgetData) -> None:
        """Check that fund summary sums to total appropriations."""
        fund_sum = sum(f.amount for f in data.appropriations.by_fund)
        total = data.metadata.total_appropriations

        if abs(fund_sum - total) > self.tolerance:
            self.errors.append(
                f"Fund summary sum (${fund_sum:,}) does not match total appropriations "
                f"(${total:,}). Difference: ${abs(fund_sum - total):,}"
            )

    def _validate_unique_ids(self, data: BudgetData) -> None:
        """Check that all IDs are unique."""
        dept_ids = [d.id for d in data.appropriations.by_department]
        if len(dept_ids) != len(set(dept_ids)):
            duplicates = [did for did in dept_ids if dept_ids.count(did) > 1]
            self.errors.append(f"Duplicate department IDs found: {set(duplicates)}")

        # Check subcategory IDs within each department
        for dept in data.appropriations.by_department:
            subcat_ids = [s.id for s in dept.subcategories]
            if len(subcat_ids) != len(set(subcat_ids)):
                duplicates = [sid for sid in subcat_ids if subcat_ids.count(sid) > 1]
                self.errors.append(f"Duplicate subcategory IDs in {dept.name}: {set(duplicates)}")

    def _validate_revenue(self, data: BudgetData) -> None:
        """Validate revenue data structure and relationships.

        Checks:
        1. Revenue sources sum to total_revenue (within tolerance)
        2. Local revenue approximately matches operating appropriations (warn if >10% gap)
        3. Grant revenue gap is documented (transparency warning)
        4. Subcategory sums match source totals

        Args:
            data: Complete budget data with optional revenue
        """
        if data.revenue is None:
            return

        revenue = data.revenue
        metadata = data.metadata

        # Check 1: Hierarchical sum (sources -> total)
        source_total = sum(s.amount for s in revenue.by_source)
        if abs(source_total - revenue.total_revenue) > self.tolerance:
            self.errors.append(
                f"Revenue sources sum ({source_total:,}) does not match "
                f"total_revenue ({revenue.total_revenue:,})"
            )

        # Check 2: Revenue vs. appropriations balance
        if metadata.total_revenue is not None and metadata.total_appropriations > 0:
            rev = metadata.total_revenue
            approp = metadata.total_appropriations

            gap_pct = abs((rev - approp) / approp) * 100

            if gap_pct > 10:
                self.warnings.append(
                    f"Revenue ({rev:,}) and total appropriations ({approp:,}) "
                    f"differ by {gap_pct:.1f}%. This may indicate debt financing "
                    f"or fund balance usage."
                )

        # Check 3: Grant revenue transparency
        if revenue.grant_revenue_estimated and revenue.grant_revenue_estimated > 0:
            grant_amt = revenue.grant_revenue_estimated
            self.warnings.append(
                f"Revenue dataset excludes approximately ${grant_amt:,} in grant funding "
                f"(estimated from appropriations). Total budget including grants: "
                f"${metadata.total_appropriations:,}"
            )

        # Check 4: Subcategory sums per source
        for source in revenue.by_source:
            if source.subcategories:
                subcat_total = sum(sc.amount for sc in source.subcategories)
                if abs(subcat_total - source.amount) > self.tolerance:
                    self.errors.append(
                        f"Revenue source '{source.name}' subcategories sum ({subcat_total:,}) "
                        f"does not match source total ({source.amount:,})"
                    )

    def _validate_cross_year_consistency(self, current: BudgetData, prior: BudgetData) -> None:
        """Check for unusual year-over-year changes.

        Flags departments with >50% change as warnings.
        """
        current_depts = {d.name: d for d in current.appropriations.by_department}
        prior_depts = {d.name: d for d in prior.appropriations.by_department}

        # Check for large changes
        for name, current_dept in current_depts.items():
            if name in prior_depts:
                prior_dept = prior_depts[name]
                if prior_dept.amount > 0:
                    change_pct = (
                        (current_dept.amount - prior_dept.amount) / prior_dept.amount
                    ) * 100
                    if abs(change_pct) > 50:
                        self.warnings.append(
                            f"{name}: Large year-over-year change: {change_pct:+.1f}% "
                            f"(${prior_dept.amount:,} → ${current_dept.amount:,})"
                        )

        # Check for new departments
        new_depts = set(current_depts.keys()) - set(prior_depts.keys())
        if new_depts:
            self.warnings.append(f"New departments: {', '.join(sorted(new_depts))}")

        # Check for removed departments
        removed_depts = set(prior_depts.keys()) - set(current_depts.keys())
        if removed_depts:
            self.warnings.append(f"Removed departments: {', '.join(sorted(removed_depts))}")

    def get_report(self) -> str:
        """Get validation report as formatted string.

        Returns:
            Multi-line report with errors and warnings
        """
        lines = []

        if self.errors:
            lines.append("ERRORS:")
            for error in self.errors:
                lines.append(f"  ❌ {error}")

        if self.warnings:
            if lines:
                lines.append("")
            lines.append("WARNINGS:")
            for warning in self.warnings:
                lines.append(f"  ⚠️  {warning}")

        if not self.errors and not self.warnings:
            lines.append("✅ All validation checks passed")

        return "\n".join(lines)
