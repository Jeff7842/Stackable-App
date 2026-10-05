package documents

import (
	"strconv"
	"strings"
)

// FormatKES renders int64 minor units (cents) as "KES 1,234.56"; negatives become "-KES 5.00".
// Money stays an integer everywhere else so rounding can never change a receipt.
func FormatKES(minor int64) string {
	neg := minor < 0
	abs := uint64(minor)
	if neg {
		abs = -abs // two's complement negate also handles MinInt64
	}
	whole := strconv.FormatUint(abs/100, 10)
	cents := strconv.FormatUint(abs%100, 10)
	if len(cents) == 1 {
		cents = "0" + cents
	}
	var b strings.Builder
	for i, ch := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(ch)
	}
	out := "KES " + b.String() + "." + cents
	if neg {
		return "-" + out
	}
	return out
}
