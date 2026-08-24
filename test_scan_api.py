#!/usr/bin/env python3
"""
Test script for the /api/scan orchestration endpoint.
"""

import json
import uuid
from app.main import load_findings, ScanRequest

print("=" * 70)
print("TESTING RAKSHAK BACKEND SCAN ORCHESTRATION API")
print("=" * 70)

# Test the ScanRequest validation
print("\n[1] Testing ScanRequest model validation")
print("-" * 70)

test_cases = [
    {
        "name": "All scans enabled",
        "data": {"code_scanning": True, "dependency_scanning": True, "secret_detection": True, "container_scanning": True},
        "should_pass": True,
    },
    {
        "name": "Only dependency scanning",
        "data": {"code_scanning": False, "dependency_scanning": True, "secret_detection": False, "container_scanning": False},
        "should_pass": True,
    },
    {
        "name": "Only secret detection",
        "data": {"code_scanning": False, "dependency_scanning": False, "secret_detection": True, "container_scanning": False},
        "should_pass": True,
    },
    {
        "name": "Only container scanning",
        "data": {"code_scanning": False, "dependency_scanning": False, "secret_detection": False, "container_scanning": True},
        "should_pass": True,
    },
    {
        "name": "Nothing selected (should fail)",
        "data": {"code_scanning": False, "dependency_scanning": False, "secret_detection": False, "container_scanning": False},
        "should_pass": False,
    },
]

passed = 0
failed = 0

for test in test_cases:
    try:
        req = ScanRequest(**test["data"])
        if test["should_pass"]:
            print(f"✓ {test['name']}: PASS")
            passed += 1
        else:
            print(f"✗ {test['name']}: FAIL (should have been rejected)")
            failed += 1
    except ValueError as e:
        if not test["should_pass"]:
            print(f"✓ {test['name']}: PASS (correctly rejected)")
            passed += 1
        else:
            print(f"✗ {test['name']}: FAIL ({e})")
            failed += 1

# Test load_findings with selective scanning
print(f"\n[2] Testing load_findings with selective scanner execution")
print("-" * 70)

test_scenarios = [
    {
        "name": "All scans",
        "params": {
            "code_scanning": True,
            "dependency_scanning": True,
            "secret_detection": True,
            "container_scanning": True,
        },
    },
    {
        "name": "Only dependency",
        "params": {
            "code_scanning": False,
            "dependency_scanning": True,
            "secret_detection": False,
            "container_scanning": False,
        },
    },
    {
        "name": "Only secret detection",
        "params": {
            "code_scanning": False,
            "dependency_scanning": False,
            "secret_detection": True,
            "container_scanning": False,
        },
    },
    {
        "name": "Only container",
        "params": {
            "code_scanning": False,
            "dependency_scanning": False,
            "secret_detection": False,
            "container_scanning": True,
        },
    },
]

for scenario in test_scenarios:
    try:
        findings = load_findings(use_ai=False, **scenario["params"])
        tools = set(str(f.get("tool", "")) for f in findings)
        print(f"✓ {scenario['name']}: {len(findings)} findings from {tools}")
        passed += 1
    except Exception as e:
        print(f"✗ {scenario['name']}: {e}")
        failed += 1

# Test existing endpoints still work
print(f"\n[3] Testing that existing functions still work")
print("-" * 70)

try:
    # Test default load_findings (should load all)
    findings = load_findings(use_ai=False)
    print(f"✓ Default load_findings: {len(findings)} total findings")
    passed += 1
except Exception as e:
    print(f"✗ Default load_findings: {e}")
    failed += 1

print(f"\n" + "=" * 70)
print(f"SUMMARY: {passed} passed, {failed} failed")
print("=" * 70)

if failed == 0:
    print("\n✓ All tests passed!")
    exit(0)
else:
    print(f"\n✗ {failed} test(s) failed!")
    exit(1)
