# Brightness Perception Experiment

This project is a web-based psychological experiment designed to investigate how the emotional valence of words affects brightness perception. The experiment is implemented using jsPsych, a JavaScript library for running behavioral experiments in a web browser.

## Table of Contents
1. [Experiment Overview](#experiment-overview)
2. [Setup](#setup)
3. [Experiment Structure](#experiment-structure)
4. [Data Collection](#data-collection)
5. [Dependencies](#dependencies)
6. [Customization](#customization)
7. [Ethical Considerations](#ethical-considerations)
8. [Support](#support)

## Experiment Overview

The experiment consists of several phases:
1. Introduction and instructions
2. Practice trials
3. Main experiment trials
4. Valence rating task
5. Debriefing

Participants are shown words followed by gray squares and are asked to judge whether each square is brighter or darker than a reference square. The experiment includes a misdirection task where participants are instructed to identify repeated words.

## Setup

1. Ensure you have a web server set up to host the HTML file.
2. Place the HTML file in your web server's root directory.
3. Modify the Prolific ID, Study ID, and Session ID variables if necessary.
4. Update the jsPsychPipe settings with your own experiment ID.

## Experiment Structure

- **Practice Trials**: Participants familiarize themselves with the task.
- **Main Trials**: Words from different emotional categories (positive, negative, neutral) are presented, followed by gray squares.
- **Valence Rating**: Participants rate the emotional valence of the words they saw.
- **Debrief**: Explains the true nature of the experiment and provides performance feedback.

## Data Collection

The experiment collects the following data:
- Response times
- Brightness judgments
- Word valence ratings
- Performance on the misdirection task

Data is saved using jsPsychPipe and can be exported as a CSV file.

## Dependencies

This experiment relies on the following libraries:
- jsPsych (version 7.3.4)
- jsPsych plugins:
  - html-keyboard-response (version 1.1.3)
  - jspsych-contrib/plugin-pipe

Ensure these dependencies are correctly linked in the HTML file.

## Customization

You can customize various aspects of the experiment:
- Modify the `test_stimuli` array to change the words used.
- Adjust timing parameters in the trial procedures.
- Change the number of practice or main trials.
- Modify the instructions or debriefing text.

## Ethical Considerations

This experiment involves mild deception (the misdirection task and the true nature of the brightness judgment). Ensure you have proper ethical approval before running this experiment, and always provide a thorough debriefing to participants.

## Support

For questions or issues, please contact Edwin Cortazo / edwincortazo@gmail.com

---

This project is for research purposes only. Please ensure compliance with all relevant ethical guidelines and data protection regulations when using this experiment.
