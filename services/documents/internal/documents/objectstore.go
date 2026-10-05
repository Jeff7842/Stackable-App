package documents

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ObjectStore keeps rendered files and hands out time-limited download links.
type ObjectStore interface {
	Put(ctx context.Context, key, contentType string, data []byte) error
	Exists(ctx context.Context, key string) (bool, error)
	SignedURL(key string, ttl time.Duration) (string, error)
}

var keyPattern = regexp.MustCompile(`^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$`)

// validKey blocks absolute paths and ".." so a key can never leave the store directory.
func validKey(key string) bool {
	if !keyPattern.MatchString(key) {
		return false
	}
	for _, seg := range strings.Split(key, "/") {
		if seg == ".." || seg == "." {
			return false
		}
	}
	return true
}

// LocalStore writes files under a directory and signs links with an HMAC expiry.
type LocalStore struct {
	dir    string
	secret []byte
	clock  func() time.Time
}

// NewLocalStore refuses an empty secret so links can never be signed with a known key.
func NewLocalStore(dir string, secret []byte, clock func() time.Time) (*LocalStore, error) {
	if dir == "" || len(secret) == 0 {
		return nil, errors.New("local store needs a directory and a signing secret")
	}
	if clock == nil {
		clock = time.Now
	}
	return &LocalStore{dir: dir, secret: secret, clock: clock}, nil
}

func (s *LocalStore) path(key string) (string, error) {
	if !validKey(key) {
		return "", linkInvalidErr()
	}
	return filepath.Join(s.dir, filepath.FromSlash(key)), nil
}

// Put writes through a temp file so a reader never sees a half-written document.
func (s *LocalStore) Put(_ context.Context, key, _ string, data []byte) error {
	p, err := s.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, data, 0o640); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	if err := os.Rename(tmp, p); err != nil {
		return fmt.Errorf("rename file: %w", err)
	}
	return nil
}

// Exists reports whether the file is stored.
func (s *LocalStore) Exists(_ context.Context, key string) (bool, error) {
	p, err := s.path(key)
	if err != nil {
		return false, err
	}
	_, statErr := os.Stat(p)
	if errors.Is(statErr, os.ErrNotExist) {
		return false, nil
	}
	return statErr == nil, statErr
}

func (s *LocalStore) sign(key string, exp int64) string {
	m := hmac.New(sha256.New, s.secret)
	fmt.Fprintf(m, "%s\n%d", key, exp)
	return hex.EncodeToString(m.Sum(nil))
}

// SignedURL returns a path with an expiry and signature that Open verifies.
func (s *LocalStore) SignedURL(key string, ttl time.Duration) (string, error) {
	if !validKey(key) {
		return "", linkInvalidErr()
	}
	exp := s.clock().Add(ttl).Unix()
	return fmt.Sprintf("/v1/files/%s?exp=%d&sig=%s", key, exp, s.sign(key, exp)), nil
}

// Open verifies the signature and expiry, then returns the file bytes.
func (s *LocalStore) Open(key, expStr, sig string) ([]byte, error) {
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || !validKey(key) {
		return nil, linkInvalidErr()
	}
	if !hmac.Equal([]byte(sig), []byte(s.sign(key, exp))) {
		return nil, linkInvalidErr()
	}
	if s.clock().Unix() > exp { // checked after the signature so only genuine links reveal expiry
		return nil, linkExpiredErr()
	}
	p, _ := s.path(key)
	data, err := os.ReadFile(p)
	if errors.Is(err, os.ErrNotExist) {
		return nil, notFoundErr()
	}
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}
	return data, nil
}
