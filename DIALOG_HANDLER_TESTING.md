# Dialog Handler Testing Guide

## Overview
This guide provides comprehensive testing scenarios for the `chrome_dismiss_dialog` tool implemented to resolve Issue #92.

## Test Environment Setup

1. **Build the Extension**
   ```bash
   pnpm install
   pnpm build
   ```

2. **Load Extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the built extension directory

3. **Open Test Page**
   ```bash
   # Open test-dialogs.html in Chrome
   # Or use a simple HTTP server:
   python3 -m http.server 8000
   # Then navigate to http://localhost:8000/test-dialogs.html
   ```

## Test Scenarios

### Test 1: Basic Alert Dialog
**Setup:**
```javascript
alert('This is a test alert');
```

**MCP Tool Call:**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {
    "accept": true
  }
}
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Successfully dismissed alert dialog",
  "dialogInfo": {
    "type": "alert",
    "message": "This is a test alert"
  },
  "action": "accepted",
  "waitTime": 150,
  "tabId": 123,
  "tabUrl": "http://localhost:8000/test-dialogs.html"
}
```

---

### Test 2: Confirm Dialog - Accept
**Setup:**
```javascript
const result = confirm('Do you want to proceed?');
console.log('User chose:', result); // Should log: true
```

**MCP Tool Call:**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {
    "accept": true
  }
}
```

**Expected Result:**
- Dialog dismissed with OK
- Console logs: "User chose: true"

---

### Test 3: Confirm Dialog - Cancel
**Setup:**
```javascript
const result = confirm('Do you want to delete this?');
console.log('User chose:', result); // Should log: false
```

**MCP Tool Call:**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {
    "accept": false
  }
}
```

**Expected Result:**
- Dialog dismissed with Cancel
- Console logs: "User chose: false"

---

### Test 4: Prompt Dialog with Text
**Setup:**
```javascript
const name = prompt('Please enter your name:', 'Default Name');
console.log('User entered:', name); // Should log: "Test User"
```

**MCP Tool Call:**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {
    "accept": true,
    "promptText": "Test User"
  }
}
```

**Expected Result:**
- Dialog dismissed with custom text
- Console logs: "User entered: Test User"

---

### Test 5: Prompt Dialog - Cancel
**Setup:**
```javascript
const name = prompt('Please enter your name:');
console.log('User entered:', name); // Should log: null
```

**MCP Tool Call:**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {
    "accept": false
  }
}
```

**Expected Result:**
- Dialog dismissed with Cancel
- Console logs: "User entered: null"

---

### Test 6: Timeout - No Dialog Present
**Setup:**
- No dialog on the page

**MCP Tool Call:**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {
    "timeout": 2000
  }
}
```

**Expected Result:**
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Error dismissing dialog: No dialog appeared within 2000ms..."
  }]
}
```

---

### Test 7: Delayed Dialog (Auto-trigger)
**Setup:**
```javascript
setTimeout(() => {
  alert('Delayed alert after 2 seconds');
}, 2000);
```

**MCP Tool Call (immediately after page load):**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {
    "accept": true,
    "timeout": 5000
  }
}
```

**Expected Result:**
- Tool waits for dialog to appear
- Dismisses it automatically when it appears
- Reports waitTime ~2000ms

---

### Test 8: Multiple Dialogs in Sequence
**Setup:**
```javascript
alert('First dialog');
alert('Second dialog');
```

**MCP Tool Call (call twice):**
1. First call dismisses first dialog
2. Second call dismisses second dialog

**Note:** Each call handles one dialog. For multiple dialogs, multiple tool calls are needed.

---

### Test 9: BeforeUnload Dialog
**Setup:**
```javascript
window.addEventListener('beforeunload', (e) => {
  e.preventDefault();
  e.returnValue = '';
});
```

**Test:**
1. Call tool with `accept: true, timeout: 5000`
2. Try to navigate away or close tab
3. BeforeUnload dialog should be dismissed automatically

---

### Test 10: Chrome Internal Pages (Error Case)
**Setup:**
- Navigate to `chrome://extensions/`

**MCP Tool Call:**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {}
}
```

**Expected Result:**
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Error dismissing dialog: Cannot access tab... The page may be a Chrome internal page..."
  }]
}
```

---

### Test 11: DevTools Already Attached (Error Case)
**Setup:**
1. Open Chrome DevTools (F12)
2. Keep DevTools open

**MCP Tool Call:**
```json
{
  "name": "chrome_dismiss_dialog",
  "arguments": {}
}
```

**Expected Result:**
```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "Debugger is already attached to tab... Please close DevTools and try again."
  }]
}
```

---

### Test 12: Parameter Validation
**Test Cases:**

1. **Timeout too low:**
   ```json
   { "timeout": 50 }
   ```
   → Adjusted to MIN_TIMEOUT (100ms)

2. **Timeout too high:**
   ```json
   { "timeout": 60000 }
   ```
   → Adjusted to MAX_TIMEOUT (30000ms)

3. **Invalid promptText type:**
   ```json
   { "promptText": 12345 }
   ```
   → Converted to string "12345"

4. **Invalid accept type:**
   ```json
   { "accept": "yes" }
   ```
   → Converted to boolean true

---

## Performance Metrics

Track these metrics during testing:

1. **Wait Time:** Time from tool call to dialog detection
   - Expected: 0-100ms for existing dialogs
   - Expected: 100-5000ms for delayed dialogs

2. **Total Execution Time:** End-to-end time
   - Expected: < 200ms for immediate dialogs
   - Expected: < timeout for delayed dialogs

3. **Resource Cleanup:** Verify debugger is detached
   - Check `chrome://inspect/#devices`
   - No lingering debugger connections

---

## Integration Testing with MCP

### Test with Real Automation Scenario

**Scenario:** Form submission triggers alert

```javascript
// Page code:
document.getElementById('submitBtn').addEventListener('click', () => {
  // ... submit form ...
  alert('Form submitted successfully!');
});
```

**MCP Automation Flow:**
1. `chrome_click_element` - Click submit button
2. **Page shows alert → MCP times out**
3. `chrome_dismiss_dialog` - Dismiss the alert
4. Continue with next steps

**Expected:** Dialog is dismissed, automation continues

---

## Success Criteria

- ✅ All alert dialogs can be dismissed
- ✅ Confirm dialogs can be accepted or cancelled
- ✅ Prompt dialogs can receive custom text
- ✅ BeforeUnload dialogs can be handled
- ✅ Proper error handling for edge cases
- ✅ Debugger is always detached after operation
- ✅ Clear error messages for common issues
- ✅ Parameter validation works correctly
- ✅ Performance is acceptable (< 5s for most cases)
- ✅ No resource leaks (memory, debugger connections)

---

## Known Limitations

1. **One dialog at a time:** The tool handles one dialog per call. For multiple sequential dialogs, multiple calls are needed.

2. **Timeout required:** The tool must wait for the dialog event. If no dialog appears, it will timeout.

3. **Chrome internal pages:** Cannot attach debugger to chrome:// pages or extension pages.

4. **DevTools conflict:** Cannot attach debugger if Chrome DevTools is already attached.

5. **Permission dialogs:** This tool only handles JavaScript dialogs (alert/confirm/prompt/beforeunload), not browser permission dialogs.

---

## Troubleshooting

### Issue: "Timeout waiting for dialog"
**Cause:** No dialog appeared within timeout period
**Solutions:**
- Check if dialog actually exists on the page
- Increase timeout value
- Check if dialog was already dismissed

### Issue: "Debugger already attached"
**Cause:** DevTools or another extension is using the debugger
**Solutions:**
- Close Chrome DevTools
- Disable other extensions that use debugger
- Restart Chrome

### Issue: "Cannot access tab"
**Cause:** Trying to access restricted page
**Solutions:**
- Don't use on chrome:// pages
- Check debugger permission in manifest

---

## Automated Testing (Future)

To add automated tests, create:

1. **Unit tests** for parameter validation
2. **Integration tests** with mock Chrome APIs
3. **E2E tests** using Puppeteer or Playwright

Example test structure:
```typescript
describe('DismissDialogTool', () => {
  it('should validate timeout parameters', () => {
    // Test MIN_TIMEOUT, MAX_TIMEOUT validation
  });

  it('should handle alert dialogs', async () => {
    // Test alert dismissal
  });

  // ... more tests
});
```

---

## Manual Testing Checklist

- [ ] Test 1: Basic Alert
- [ ] Test 2: Confirm Accept
- [ ] Test 3: Confirm Cancel
- [ ] Test 4: Prompt with Text
- [ ] Test 5: Prompt Cancel
- [ ] Test 6: Timeout No Dialog
- [ ] Test 7: Delayed Dialog
- [ ] Test 8: Multiple Dialogs
- [ ] Test 9: BeforeUnload
- [ ] Test 10: Chrome Internal Page Error
- [ ] Test 11: DevTools Conflict Error
- [ ] Test 12: Parameter Validation
- [ ] Performance Check: < 5s response time
- [ ] Resource Check: No leaks after 10 operations

---

## Report Template

```
Test Date: YYYY-MM-DD
Tester: [Name]
Extension Version: [Version]
Chrome Version: [Version]

Test Results:
- Test 1: ✅ Pass / ❌ Fail - [Notes]
- Test 2: ✅ Pass / ❌ Fail - [Notes]
...

Performance Metrics:
- Average wait time: [X]ms
- Maximum wait time: [X]ms
- Resource cleanup: ✅ / ❌

Issues Found:
1. [Issue description]
2. [Issue description]

Overall Status: ✅ Pass / ⚠️ Pass with issues / ❌ Fail
```
