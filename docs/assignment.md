# Assignment — Bandwidth Check and Web Camera Quality Selector


## Overview

Create a simple, responsive web application in Angular that evaluates the user's bandwidth, dynamically adjusts the quality of web camera recordings (low, medium, or high), and allows users to record short video snippets. All recordings must persist and remain accessible after refreshing or reopening the browser tab.

This assignment focuses solely on front-end development. No server-side implementation is required.

---

## Specifications

### 1. Figma design

Provided as a Figma file. Design per-screen notes live in [`design-notes.md`](./design-notes.md).

### 2. Application features

#### Bandwidth check

- Measure the user's bandwidth when the app loads.
- Use the following breakpoints to determine video quality:
  - **Low Quality:** bandwidth **< 2 Mbps**
  - **Medium Quality:** bandwidth **between 2 Mbps and 5 Mbps**
  - **High Quality:** bandwidth **> 5 Mbps**

#### Web camera quality settings

- Automatically set the recording quality based on the detected bandwidth:
  - **Low Quality:** 360p resolution
  - **Medium Quality:** 720p resolution
  - **High Quality:** 1080p resolution
- Allow the user to manually override the quality setting (Low / Medium / High).

#### Video recording

- Limit recordings to a maximum of **10 seconds**, but allow users to stop the recording earlier.

#### Saved videos

- Display a list of all saved videos in the section on the right.
- Allow users to play and delete saved videos.

#### Persistence

- Ensure all recorded videos remain available after a browser tab refresh or reopen.

### 3. Design requirements

- Implement a clean and responsive design that adapts well to various screen sizes.
- Handle errors gracefully (e.g., if the webcam is not accessible or bandwidth detection fails).

### 4. Technology constraints

- Use **NGXS** for managing application state.
- Use a technology of your choice for video storage and playback persistence.

### 5. Error handling

- If bandwidth detection fails, default to **Medium Quality** and notify the user.
- Handle webcam permission errors by showing alerts to the user.

---

## Submission

Provide a Git repository link containing:

1. **Full project code.**
   - The commit history must reflect the progression of work.
   - Avoid submitting the entire assignment as a single commit — reviewers should see incremental changes over time.

2. **A `README.md`** with:
   - Setup instructions.
   - Explanation of the chosen approach for persistence and video storage.
   - Any assumptions or challenges faced.

3. **Screenshots of the app in key states.**
