# Multi-Bucket S3 Storage Integration

This folder contains documentation detailing the multi-bucket S3 configuration for the Keil application.

---

## Overview

The Keil App uses Amazon S3 to handle binary assets across the application. To satisfy security mandates (preventing accidental disclosure of meeting audios and chat messages) and performance metrics (loading avatars and motion assets globally with sub-millisecond latencies), we utilize two separate buckets:

1. **Private Bucket:** Meeting audios and chat attachments. Accessed only via short-lived presigned URLs.
2. **Public Bucket:** Profile avatars and motion page images. Served via a CloudFront CDN.

---

## Table of Contents

* [Architecture & System Flow](./architecture.md)
* [Environment Configuration](./environment.md)

---

## Quick Start Guide

### Step 1: AWS Setup
1. **Create the Private Bucket**:
   * Block all public access: Checked.
   * Enable default encryption.
2. **Create the Public Bucket**:
   * Block all public access: Unchecked.
   * Attach bucket policy allowing public read access:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "PublicReadGetObject",
           "Effect": "Allow",
           "Principal": "*",
           "Action": "s3:GetObject",
           "Resource": "arn:aws:s3:::your-public-bucket-name/*"
         }
       ]
     }
     ```
3. **Configure CDN (Optional but recommended)**:
   * Setup Amazon CloudFront with your public bucket as origin.

### Step 2: Update local configuration
Add configuration keys into the backend `.env` file as documented in the [Environment Reference](./environment.md).
