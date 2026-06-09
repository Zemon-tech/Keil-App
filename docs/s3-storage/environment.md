# S3 Storage Environment Configuration

This reference documents the environment variables required on both the backend and frontend to support the multi-bucket S3 configuration.

---

## Backend Environment Variables

Add the following keys to your backend `.env` file:

| Variable Name | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `AWS_S3_REGION` | Yes | The AWS region where S3 buckets are hosted. | `ap-south-1` |
| `AWS_S3_ACCESS_KEY_ID` | Yes | AWS IAM access key ID with permission to access S3 buckets. | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_S3_SECRET_ACCESS_KEY` | Yes | AWS IAM secret access key. | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_S3_BUCKET_NAME` | Yes | Name of the **private** bucket storing meeting recordings & chat files. | `keil-app-private` |
| `AWS_S3_PUBLIC_BUCKET_NAME` | Yes | Name of the **public** bucket storing profile icons & motion assets. | `keil-app-public` |
| `AWS_S3_PUBLIC_CDN_URL` | No | Public endpoint base URL (can be a CDN domain or directly the S3 regional URL). | `https://keil-app-public.s3.ap-south-1.amazonaws.com` |

---

## IAM Policy Guidelines

Ensure that the IAM credentials provided (`AWS_S3_ACCESS_KEY_ID` & `AWS_S3_SECRET_ACCESS_KEY`) are bound to an IAM user/role with the following policy permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::keil-app-private/*",
        "arn:aws:s3:::keil-app-public/*"
      ]
    }
  ]
}
```

---

## Security Warnings

> [!WARNING]
> Keep credentials secure. Never commit the `.env` file containing access keys to public repository branches.
>
> [!IMPORTANT]
> The private bucket (`AWS_S3_BUCKET_NAME`) **must** have block all public access turned on. S3 permissions should never allow public-read (`s3:GetObject`) for this bucket.
