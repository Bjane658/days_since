# Days Since - Task Tracker

A simple web application to track how many days have passed since you last completed household tasks like vacuuming, cleaning the kitchen, etc.

## Features

- Add tasks to track (e.g., "Vacuumed the floor", "Cleaned the kitchen")
- Optional cycle per task: how often the task should be done (e.g., every 7 days)
- Each task displays the number of days since last completion
- Tasks with a cycle show when they are due ("due in 3 days", "due today", "2 days overdue")
- Click on a tile or the "Done Today!" button to reset the counter
- Color-coded tiles:
  - With cycle: green while ahead of schedule, orange at/just past the due day, red when overdue
  - Without cycle: green 0-2 days (fresh), orange 3-7 days (warning), red 8+ days (overdue)
- Data persisted as JSON files in the `data/` directory
- Full history tracking for future analysis

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open your browser and navigate to:
```
http://127.0.0.1:5000
```

## Usage

### Adding a Task
1. Type the task name in the input field (e.g., "Vacuumed the floor")
2. Optionally enter a cycle in days ("Every __ days", e.g., 7)
3. Click "Add Task"
4. The task will appear as a tile showing 0 days

### Editing the Cycle
- Click on a task tile to open the edit dialog
- Change or clear the "Cycle (days)" field and save
- Clearing the field removes the cycle; the task then uses the default color thresholds

### Resetting a Task
- Click anywhere on the task tile, OR
- Click the "Done Today!" button

### Deleting a Task
- Click the "×" button on the task tile

## Data Structure

Each task is stored as a JSON file in the `data/` directory with the following structure:

```json
{
  "id": "vacuumed_the_floor",
  "name": "Vacuumed the floor",
  "lastReset": "2026-01-31",
  "cycle": 7,
  "history": [
    "2026-01-15",
    "2026-01-22",
    "2026-01-31"
  ]
}
```

`cycle` is optional: a whole number of days specifying how often the task should be done. Omit it (or set it to `null`) for tasks without a fixed interval.

## Command Line Options

```bash
python app.py --help
```

Options:
- `--dir`: Directory to save task files (default: ./data)
- `--host`: Host to run the server on (default: 127.0.0.1)
- `--port`: Port to run the server on (default: 5000)

Example:
```bash
python app.py --port 8000 --dir ~/my_tasks
```

## Future Enhancements

- Analysis view showing reset history
- Average days between resets
- Statistics and charts
- Task categories
- Custom color thresholds per task
