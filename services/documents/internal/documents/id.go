package documents

import (
	"crypto/rand"
	"fmt"
	"regexp"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func isUUID(s string) bool { return uuidPattern.MatchString(s) }

// newUUID returns a random v4 uuid; the database columns are uuid, so ids must be valid ones.
func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b) // crypto/rand does not fail on supported platforms
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
