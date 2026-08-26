# HerdVitals dataset registry

Do not combine source files until units, sampling frequency, cohort identity,
licence, label definition, and event timing have been documented.

## Approved source roles

| Source | Licence | Intended use | Forecasting limitation |
| --- | --- | --- | --- |
| [Chinese Holstein EC/SCS](https://doi.org/10.17632/32hkvvbcgf.4) | CC BY 4.0 | EC and activity preprocessing; same-day subclinical benchmark | SCC is much less frequent than milking records, so it does not independently prove 7-to-14-day event forecasting |
| [Argentine SCC and milk yield](https://doi.org/10.17632/d8kgk57b9h.3) | CC BY 4.0 | Longitudinal baseline and multi-herd robustness experiments | Test-day SCC is approximately 30–40 days apart |
| [Clinical Mastitis IoT](https://doi.org/10.17632/kbvcdw5b4m.1) | CC BY 4.0 | Secondary labelled detection benchmark | Sensor contract differs from HerdVitals EC telemetry |
| [AgriFoodTEF milking robot demo](https://doi.org/10.5281/zenodo.17045457) | Check record before use | Simulator schema and integration testing | Explicitly synthetic; never clinical validation |

## Acquisition state

The Mendeley public metadata endpoint currently requires authenticated API
access. Raw files are therefore not committed or automatically downloaded.
Use the DOI pages, retain their original filenames and checksums, and store raw
files under `ml/datasets/raw/`, which is git-ignored. Record any transformation
in a reproducible adapter before model training.

## Minimum canonical fields

- `animal_id`
- `observed_at`
- `milk_ec`
- `milk_temperature`
- optional `milk_yield`, `activity`, `rumination`, and `scc`; yield and SCC are
  stored for outcomes/context but excluded from default early-warning features
- separate confirmed `event_time` and `diagnosis_method`

An SCC threshold measured on the same row is a detection label. A genuine
forecast label requires the earliest known clinical onset to occur between 7
and 14 days after `observed_at`. Rows closer than seven days to onset are
excluded rather than labelled negative.
