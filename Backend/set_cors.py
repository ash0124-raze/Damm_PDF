import boto3
from core.config import settings

s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name='auto'
)

cors_configuration = {
    'CORSRules': [{
        'AllowedHeaders': ['*'],
        'AllowedMethods': ['PUT', 'POST', 'GET', 'HEAD'],
        'AllowedOrigins': ['*'], # Allows any frontend URL
        'ExposeHeaders': ['ETag'],
        'MaxAgeSeconds': 3600
    }]
}

try:
    s3_client.put_bucket_cors(
        Bucket=settings.S3_BUCKET_NAME,
        CORSConfiguration=cors_configuration
    )
    print("Success! S3 API CORS rules injected into Backblaze.")
except Exception as e:
    print(f"Failed: {e}")