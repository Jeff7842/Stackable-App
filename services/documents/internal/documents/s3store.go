package documents

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// S3Config holds the Cloudflare R2 (S3-compatible) settings.
type S3Config struct {
	Endpoint, AccessKeyID, SecretAccessKey, Bucket string
}

// S3Store keeps files in an S3-compatible bucket and signs download links with presigned GETs.
type S3Store struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
}

// NewS3StoreFromEnv returns (nil, nil) when R2_ENDPOINT is unset, so the local store stays the default.
func NewS3StoreFromEnv() (*S3Store, error) {
	cfg := S3Config{
		Endpoint:        os.Getenv("R2_ENDPOINT"),
		AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		Bucket:          os.Getenv("R2_BUCKET_PRIVATE"),
	}
	if cfg.Endpoint == "" {
		return nil, nil
	}
	return NewS3Store(cfg)
}

// NewS3Store fails when any setting is missing, so a half-configured bucket is caught at startup.
func NewS3Store(cfg S3Config) (*S3Store, error) {
	if cfg.Endpoint == "" || cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" || cfg.Bucket == "" {
		return nil, errors.New("R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_PRIVATE must all be set")
	}
	client := s3.New(s3.Options{
		Region:       "auto", // R2 ignores the region but the signer needs one
		BaseEndpoint: aws.String(cfg.Endpoint),
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		UsePathStyle: true,
	})
	return &S3Store{client: client, presign: s3.NewPresignClient(client), bucket: cfg.Bucket}, nil
}

// Put uploads the file.
func (s *S3Store) Put(ctx context.Context, key, contentType string, data []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: &s.bucket, Key: &key, Body: bytes.NewReader(data), ContentType: &contentType,
	})
	if err != nil {
		return fmt.Errorf("put object: %w", err)
	}
	return nil
}

// Exists checks the object with a HEAD request.
func (s *S3Store) Exists(ctx context.Context, key string) (bool, error) {
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &s.bucket, Key: &key})
	var nf *types.NotFound
	if errors.As(err, &nf) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("head object: %w", err)
	}
	return true, nil
}

// SignedURL presigns a GET that stops working after ttl.
func (s *S3Store) SignedURL(key string, ttl time.Duration) (string, error) {
	req, err := s.presign.PresignGetObject(context.Background(),
		&s3.GetObjectInput{Bucket: &s.bucket, Key: &key}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("presign: %w", err)
	}
	return req.URL, nil
}
