# Space Invaders Bot

This project is a cron-driven Node.js bot, written in TypeScript, that retrieves the latest "Space Invaders" flash images, processes them, uploads them to S3 storage, and posts the data to a specified API endpoint.

## Features

- Fetches the latest flash images from a custom `SpaceInvaders` utility.
- Handles image upload to S3 via a custom `uploadImageHandler`.
- Posts processed flash data to a provided API endpoint.
- Scheduled to run every minute using `node-cron`.

---

## Installation

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) (Node.js package manager)

### Steps

#### Clone the repository

```bash
   git clone <repository-url>
   cd <repository-folder>
```

#### Install dependencies

```bash
npm install
```

#### Create a .env file in the root directory and define the following environment variables

```bash
API_URL=<your-api-url>
WEBHOOK_SECRET=<your-webhook-secret>
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_S3_BUCKET=<your-s3-bucket-name>
```

#### Compile the TypeScript code

```bash
npm run build
```

#### Start the application

```bash
npm start
```
