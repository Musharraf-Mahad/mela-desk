# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agent-workflow.spec.ts >> Agent Support Queue, Claiming, Notes and Customer Visibility >> 9. Agent status updates through the backend
- Location: e2e\agent-workflow.spec.ts:112:7

# Error details

```
Error: browserContext.newPage: Executable doesn't exist at C:\Users\user\AppData\Local\ms-playwright\ffmpeg-1013\ffmpeg-win64.exe
╔═════════════════════════════════════════════════════════════════╗
║ Video rendering requires ffmpeg binary.                         ║
║ Downloading it will not affect any of the system-wide settings. ║
║ Please run the following command:                               ║
║                                                                 ║
║     npx playwright install ffmpeg                               ║
║                                                                 ║
║ <3 Playwright Team                                              ║
╚═════════════════════════════════════════════════════════════════╝
```