# Python scripts
This directory contains scripts used for obtaining data from the hansard, ingesting it into the database, and generating the required summaries. In order to run these scripts, you must install dependencies inside this directory. Assuming you are currently in the root directory, this can be done as follows:
```bash
cd python
uv sync
```

## Main
The two functions here are the main ones used in the data processing pipeline.
- `batch_process.py` ingests parliament sitting data for a given date range (inclusive of both start and end).
   ### Usage
  ```bash
  uv run batch_process.py START_DATE [END_DATE]
  ```
  ### Examples
  ```bash
  # Single date
  uv run batch_process.py 14-01-2026
  
  # Range of dates
  uv run batch_process.py 12-01-2026 14-01-2026
  ```

- `generate_summaries.py` generates summaries for sections, bills, and MPs using Llama 3.1 via Groq's API. The `--only-blank` flag is used to indicate that only entries which don't have summaries yet should be generated. 

   Note that the code contains mechanisms for rate limiting due to restrictions on Groq's free tier. If you are using a different provider with higher rate limits, you should change some of these settings in the script to make it run much faster.
   ### Usage
   ```bash
   # For sittings
   uv run generate_summaries.py --sittings START_DATE [END_DATE] [--only-blank]
   # For MPs
   uv run generate_summaries.py --members [--only-blank]
   ```
   ### Examples
  ```bash
  # Range of dates
  uv run generate_summaries.py --sessions 12-01-2026 14-01-2026
  
  # MPs (based on last 20 contributions)
  uv run generate_summaries.py --members
  
  # Only fill in missing summaries
  uv run generate_summaries.py --sessions 12-01-2026 --only-blank
  ```

## Recovery
These two scripts are helpful for cleaning up the database, especially if mistakes were made in the ingestion process.
- `cleanup_duplicates.py`: Identifies and removes duplicate sections (i.e. questions, bills, and motions) from the database. It identifies duplicates based on session ID, title, and section type, preserving the oldest or newest record as specified.
   ### Usage
   ```bash
   uv run cleanup_duplicates.py START_DATE [END_DATE] [--keep-newest]
   ```
   ### Examples
  ```bash
  # Range of dates (default: keep oldest)
  uv run cleanup_duplicates.py 12-01-2026 14-01-2026
  
  # Keep newest instead
  uv run cleanup_duplicates.py 12-01-2026 14-01-2026 --keep-newest
  ```

- `merge_bills.py`: Detects duplicate bills based on normalised titles (case-insensitive, trimmed). It merges them by moving associated sections to a master bill (the one with the most sections or oldest creation time) and deleting the duplicate bill records. This is useful because the same bill sometimes gets interrupted by other sections (e.g. a motion for time extension) or span across different sittings.
   ### Usage
  ```bash
  uv run merge_bills.py
  ```
