#!/usr/bin/env python3
"""
Test the /api/scan endpoint by starting the FastAPI server and making requests.
"""

import subprocess
import time
import requests
import json
import sys
from pathlib import Path

print("=" * 70)
print("TESTING RAKSHAK /api/scan ENDPOINT")
print("=" * 70)

# Start the FastAPI server
print("\n[1] Starting FastAPI server on http://127.0.0.1:8000")
print("-" * 70)

server_process = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
)

# Wait for server to start
print("Waiting for server to start...")
time.sleep(3)

server_running = False
for attempt in range(10):
    try:
        response = requests.get("http://127.0.0.1:8000/health", timeout=2)
        if response.status_code == 200:
            print("✓ Server is running")
            server_running = True
            break
    except requests.exceptions.ConnectionError:
        time.sleep(0.5)

if not server_running:
    print("✗ Server failed to start")
    server_process.terminate()
    sys.exit(1)

# Test cases
test_results = []

print("\n[2] Testing POST /api/scan endpoint")
print("-" * 70)

test_cases = [
    {
        "name": "TEST 1: All scans enabled",
        "payload": {
            "code_scanning": True,
            "dependency_scanning": True,
            "secret_detection": True,
            "container_scanning": True,
        },
        "expect_success": True,
    },
    {
        "name": "TEST 2: Only dependency scanning",
        "payload": {
            "code_scanning": False,
            "dependency_scanning": True,
            "secret_detection": False,
            "container_scanning": False,
        },
        "expect_success": True,
    },
    {
        "name": "TEST 3: Only secret detection",
        "payload": {
            "code_scanning": False,
            "dependency_scanning": False,
            "secret_detection": True,
            "container_scanning": False,
        },
        "expect_success": True,
    },
    {
        "name": "TEST 4: Only container scanning",
        "payload": {
            "code_scanning": False,
            "dependency_scanning": False,
            "secret_detection": False,
            "container_scanning": True,
        },
        "expect_success": True,
    },
    {
        "name": "TEST 5: Nothing selected (should fail)",
        "payload": {
            "code_scanning": False,
            "dependency_scanning": False,
            "secret_detection": False,
            "container_scanning": False,
        },
        "expect_success": False,
    },
]

for test in test_cases:
    try:
        response = requests.post(
            "http://127.0.0.1:8000/api/scan",
            json=test["payload"],
            timeout=10,
        )

        if test["expect_success"]:
            if response.status_code in [200, 201]:
                result = response.json()
                scan_id = result.get("scan_id", "N/A")
                findings = result.get("total_findings", 0)
                status = result.get("status", "unknown")
                print(f"✓ {test['name']}")
                print(f"  - Scan ID: {scan_id}")
                print(f"  - Status: {status}")
                print(f"  - Total findings: {findings}")
                print(f"  - Selected: {result.get('selected_scans', {})}")
                test_results.append((test["name"], True))
            else:
                print(f"✗ {test['name']}: Expected 200, got {response.status_code}")
                print(f"  Response: {response.text[:200]}")
                test_results.append((test["name"], False))
        else:
            if response.status_code in [400, 422]:
                print(f"✓ {test['name']}: Correctly rejected")
                test_results.append((test["name"], True))
            else:
                print(f"✗ {test['name']}: Expected 400/422, got {response.status_code}")
                test_results.append((test["name"], False))

    except Exception as e:
        print(f"✗ {test['name']}: {e}")
        test_results.append((test["name"], False))

# Test existing endpoints still work
print("\n[3] Testing existing endpoints")
print("-" * 70)

existing_endpoints = [
    ("GET /health", "http://127.0.0.1:8000/health"),
    ("GET /", "http://127.0.0.1:8000/"),
    ("GET /api/summary", "http://127.0.0.1:8000/api/summary"),
    ("GET /api/findings", "http://127.0.0.1:8000/api/findings"),
    ("GET /api/findings/CVE-2026-54371", "http://127.0.0.1:8000/api/findings/CVE-2026-54371"),
    ("GET /api/findings/CVE-2026-54371/analyze", "http://127.0.0.1:8000/api/findings/CVE-2026-54371/analyze"),
]

for endpoint_name, endpoint_url in existing_endpoints:
    try:
        response = requests.get(endpoint_url, timeout=10)
        if response.status_code == 200:
            print(f"✓ {endpoint_name}")
            test_results.append((endpoint_name, True))
        else:
            print(f"✗ {endpoint_name}: Got {response.status_code}")
            test_results.append((endpoint_name, False))
    except Exception as e:
        print(f"✗ {endpoint_name}: {e}")
        test_results.append((endpoint_name, False))

# Stop the server
print("\n[4] Stopping server")
print("-" * 70)
server_process.terminate()
server_process.wait(timeout=5)
print("✓ Server stopped")

# Summary
print("\n" + "=" * 70)
passed = sum(1 for _, result in test_results if result)
failed = sum(1 for _, result in test_results if not result)
print(f"SUMMARY: {passed} passed, {failed} failed out of {len(test_results)} tests")
print("=" * 70)

if failed == 0:
    print("\n✓ All API tests passed!")
    sys.exit(0)
else:
    print(f"\n✗ {failed} test(s) failed!")
    sys.exit(1)
