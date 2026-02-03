#!/usr/bin/env python3
"""
Days Since - Track days since household tasks were completed
"""
import os
import json
import argparse
from datetime import datetime, date
from flask import Flask, render_template, request, redirect, url_for, jsonify

app = Flask(__name__)
app.secret_key = 'days_since_secret_key_change_in_production'

# Default data directory
DATA_DIR = './data'


def ensure_data_dir():
    """Create data directory if it doesn't exist"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


def get_all_tasks():
    """Get all tasks from JSON files"""
    ensure_data_dir()
    tasks = []

    task_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.json')]

    for filename in task_files:
        filepath = os.path.join(DATA_DIR, filename)
        try:
            with open(filepath, 'r') as f:
                task_data = json.load(f)
                task_data['filename'] = filename

                # Calculate days since last reset
                last_reset = task_data.get('lastReset')
                if last_reset:
                    last_reset_date = datetime.strptime(last_reset, '%Y-%m-%d').date()
                    days_since = (date.today() - last_reset_date).days
                    task_data['daysSince'] = days_since
                else:
                    task_data['daysSince'] = 0

                tasks.append(task_data)
        except Exception as e:
            print(f"Error reading {filename}: {e}")

    # Sort by name
    tasks.sort(key=lambda x: x.get('name', '').lower())
    return tasks


def get_task_by_id(task_id):
    """Get a single task by its ID"""
    ensure_data_dir()
    filepath = os.path.join(DATA_DIR, f"{task_id}.json")

    try:
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                task_data = json.load(f)
                task_data['filename'] = f"{task_id}.json"
                return task_data
    except Exception as e:
        print(f"Error reading task {task_id}: {e}")

    return None


@app.route('/')
def index():
    """Display all tasks"""
    tasks = get_all_tasks()
    return render_template('index.html', tasks=tasks)


@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """API endpoint to get all tasks"""
    tasks = get_all_tasks()
    return jsonify(tasks)


@app.route('/api/tasks', methods=['POST'])
def create_task():
    """API endpoint to create a new task"""
    try:
        data = request.get_json()
        name = data.get('name')

        if not name:
            return jsonify({'error': 'Name is required'}), 400

        # Generate ID from name
        task_id = name.lower().replace(' ', '_')
        task_id = ''.join(c for c in task_id if c.isalnum() or c == '_')

        filepath = os.path.join(DATA_DIR, f"{task_id}.json")

        # Check if task already exists
        if os.path.exists(filepath):
            return jsonify({'error': 'Task already exists'}), 400

        # Create new task
        today = date.today().strftime('%Y-%m-%d')
        task = {
            'id': task_id,
            'name': name,
            'lastReset': today,
            'history': [today]
        }

        ensure_data_dir()
        with open(filepath, 'w') as f:
            json.dump(task, f, indent=2)

        return jsonify(task), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/tasks/<task_id>/reset', methods=['POST'])
def reset_task(task_id):
    """API endpoint to reset a task (mark as done today)"""
    try:
        filepath = os.path.join(DATA_DIR, f"{task_id}.json")

        if not os.path.exists(filepath):
            return jsonify({'error': 'Task not found'}), 404

        with open(filepath, 'r') as f:
            task = json.load(f)

        # Update lastReset to today
        today = date.today().strftime('%Y-%m-%d')
        task['lastReset'] = today
        task['history'].append(today)

        with open(filepath, 'w') as f:
            json.dump(task, f, indent=2)

        return jsonify(task), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    """API endpoint to get a single task"""
    try:
        task = get_task_by_id(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        return jsonify(task), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/tasks/<task_id>', methods=['PATCH'])
def update_task(task_id):
    """API endpoint to update a task's date"""
    try:
        filepath = os.path.join(DATA_DIR, f"{task_id}.json")

        if not os.path.exists(filepath):
            return jsonify({'error': 'Task not found'}), 404

        with open(filepath, 'r') as f:
            task = json.load(f)

        data = request.get_json()
        new_date = data.get('lastReset')

        if not new_date:
            return jsonify({'error': 'lastReset date is required'}), 400

        # Validate date format
        try:
            datetime.strptime(new_date, '%Y-%m-%d')
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        # Update lastReset
        task['lastReset'] = new_date

        # Add to history if not already there
        if new_date not in task.get('history', []):
            task['history'].append(new_date)

        with open(filepath, 'w') as f:
            json.dump(task, f, indent=2)

        return jsonify(task), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """API endpoint to delete a task"""
    try:
        filepath = os.path.join(DATA_DIR, f"{task_id}.json")

        if not os.path.exists(filepath):
            return jsonify({'error': 'Task not found'}), 404

        os.remove(filepath)
        return jsonify({'success': True}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def main():
    """Main entry point with CLI argument parsing"""
    parser = argparse.ArgumentParser(description='Days Since - Track household tasks')
    parser.add_argument(
        '--dir',
        type=str,
        help='Directory to save task files (default: ./data)'
    )
    parser.add_argument(
        '--host',
        type=str,
        default='127.0.0.1',
        help='Host to run the server on (default: 127.0.0.1)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=5000,
        help='Port to run the server on (default: 5000)'
    )

    args = parser.parse_args()

    # Set data directory if provided
    if args.dir:
        global DATA_DIR
        DATA_DIR = args.dir
        print(f"Tasks will be saved to: {DATA_DIR}")

    # Run the Flask app
    print(f"Starting Days Since on http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=True)


if __name__ == '__main__':
    main()
