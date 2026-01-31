# Days Since - Task Tracker

A simple web application to track how many days have passed since you last completed household tasks like vacuuming, cleaning the kitchen, etc.

## Features

- Add tasks to track (e.g., "Vacuumed the floor", "Cleaned the kitchen")
- Each task displays the number of days since last completion
- Click on a tile or the "Done Today!" button to reset the counter
- Color-coded tiles:
  - Green: 0-2 days (fresh)
  - Orange: 3-7 days (warning)
  - Red: 8+ days (overdue)
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
2. Click "Add Task"
3. The task will appear as a tile showing 0 days

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
  "history": [
    "2026-01-15",
    "2026-01-22",
    "2026-01-31"
  ]
}
```

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
