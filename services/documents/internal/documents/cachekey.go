package documents

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
)

// canonicalJSON re-encodes raw so equal objects give equal bytes (encoding/json sorts map keys).
func canonicalJSON(raw json.RawMessage) (string, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return "{}", nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber() // keeps big integers exact instead of rounding through float64
	var v any
	if err := dec.Decode(&v); err != nil {
		return "", err
	}
	out, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// CacheKey is sha256 over type, canonical params, dataVersion, format and schoolId.
// dataVersion is in the key so changed data can never be answered with an older file.
func CacheKey(schoolID string, t DocType, params json.RawMessage, dataVersion string, f Format) (string, error) {
	canon, err := canonicalJSON(params)
	if err != nil {
		return "", fmt.Errorf("canonical params: %w", err)
	}
	h := sha256.New()
	for _, part := range []string{string(t), canon, dataVersion, string(f), schoolID} {
		fmt.Fprintf(h, "%d:%s|", len(part), part) // length prefix stops "ab"+"c" colliding with "a"+"bc"
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
