# Model reports

Generated benchmark reports belong here with their data mode and validation
status. Synthetic reports demonstrate pipeline behaviour only and must never be
presented as clinical performance.

`synthetic_event_benchmark.json` is the reproducible smoke benchmark for one
7-to-14-day preclinical forecasting window. Compare PR-AUC, recall, specificity,
Brier score, and alerts per 1,000 observations together. ROC-AUC alone can look
excellent on an imbalanced problem while an operating threshold still creates
an impractical alert burden. The smoke benchmark requires at least 50% precision
on its validation period; a real deployment threshold must be chosen with farm
operators and validated on a later, independent cohort.

The event timestamp must be the earliest known clinical onset or confirmed
detection time. Observations fewer than seven days before that timestamp are
excluded from training so swelling, clots, fever, visible yield loss, and other
late signs cannot masquerade as early prediction.

Candidate negative rows also require a complete 14-day future follow-up period.
Rows near the end of a dataset are censored instead of being assumed healthy.
