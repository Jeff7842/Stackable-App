package documents

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Column is one table column; Money columns hold int64 minor units.
type Column struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Money bool   `json:"money"`
}

// TableData is the layout used by every type except receipt.
type TableData struct {
	SchoolName string           `json:"schoolName"`
	Title      string           `json:"title"`
	Columns    []Column         `json:"columns"`
	Rows       []map[string]any `json:"rows"`
}

// ReceiptLine is one charged item on a receipt.
type ReceiptLine struct {
	Description string `json:"description"`
	AmountMinor int64  `json:"amountMinor"`
}

// ReceiptData is the receipt layout; the total is always summed from the lines.
type ReceiptData struct {
	SchoolName string        `json:"schoolName"`
	ReceiptNo  string        `json:"receiptNo"`
	PayerName  string        `json:"payerName"`
	IssuedAt   string        `json:"issuedAt"`
	Lines      []ReceiptLine `json:"lines"`
}

// Total sums the line amounts.
func (r ReceiptData) Total() int64 {
	var sum int64
	for _, l := range r.Lines {
		sum += l.AmountMinor
	}
	return sum
}

// Content is validated render input: exactly one of Receipt or Table is set.
type Content struct {
	Receipt *ReceiptData
	Table   *TableData
}

// SchoolName returns the header text.
func (c Content) SchoolName() string {
	if c.Receipt != nil {
		return c.Receipt.SchoolName
	}
	return c.Table.SchoolName
}

// RowCount estimates the render size and decides sync versus queued.
func (c Content) RowCount() int {
	if c.Receipt != nil {
		return len(c.Receipt.Lines)
	}
	return len(c.Table.Rows)
}

// AsTable converts a receipt into a two-column table so xlsx has one code path.
func (c Content) AsTable() TableData {
	if c.Table != nil {
		return *c.Table
	}
	r := c.Receipt
	t := TableData{
		SchoolName: r.SchoolName,
		Title:      "Receipt " + r.ReceiptNo,
		Columns:    []Column{{Key: "description", Label: "Description"}, {Key: "amount", Label: "Amount", Money: true}},
	}
	for _, l := range r.Lines {
		t.Rows = append(t.Rows, map[string]any{"description": l.Description, "amount": json.Number(strconv.FormatInt(l.AmountMinor, 10))})
	}
	t.Rows = append(t.Rows, map[string]any{"description": "Total", "amount": json.Number(strconv.FormatInt(r.Total(), 10))})
	return t
}

// ParseContent decodes and validates the caller's data for a document type.
func ParseContent(t DocType, raw json.RawMessage) (Content, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber() // table cells keep exact integers, so money never passes through float64
	if t == TypeReceipt {
		var r ReceiptData
		if err := dec.Decode(&r); err != nil {
			return Content{}, invalid("Receipt data is malformed.", fieldError{"data", "must match the receipt shape: " + err.Error()})
		}
		if err := validateReceipt(r); err != nil {
			return Content{}, err
		}
		return Content{Receipt: &r}, nil
	}
	var tb TableData
	if err := dec.Decode(&tb); err != nil {
		return Content{}, invalid("Table data is malformed.", fieldError{"data", "must match the table shape: " + err.Error()})
	}
	if err := validateTable(tb); err != nil {
		return Content{}, err
	}
	return Content{Table: &tb}, nil
}

func validateReceipt(r ReceiptData) error {
	var f []fieldError
	if strings.TrimSpace(r.SchoolName) == "" {
		f = append(f, fieldError{"data.schoolName", "is required"})
	}
	if strings.TrimSpace(r.ReceiptNo) == "" {
		f = append(f, fieldError{"data.receiptNo", "is required"})
	}
	if len(r.Lines) == 0 {
		f = append(f, fieldError{"data.lines", "needs at least one line"})
	}
	if len(f) > 0 {
		return invalid("Receipt data is invalid.", f...)
	}
	return nil
}

func validateTable(t TableData) error {
	var f []fieldError
	if strings.TrimSpace(t.SchoolName) == "" {
		f = append(f, fieldError{"data.schoolName", "is required"})
	}
	if len(t.Columns) == 0 {
		f = append(f, fieldError{"data.columns", "needs at least one column"})
	}
	for i, c := range t.Columns {
		if c.Key == "" || c.Label == "" {
			f = append(f, fieldError{fmt.Sprintf("data.columns[%d]", i), "key and label are required"})
		}
	}
	if len(f) > 0 {
		return invalid("Table data is invalid.", f...)
	}
	for i, row := range t.Rows {
		for _, c := range t.Columns {
			if !c.Money {
				continue
			}
			if _, ok := moneyCell(row[c.Key]); !ok {
				return invalid("Table data is invalid.", fieldError{fmt.Sprintf("data.rows[%d].%s", i, c.Key), "must be an integer amount in minor units"})
			}
		}
	}
	return nil
}

// moneyCell reads a minor-unit integer; anything else (float, string, missing) is rejected.
func moneyCell(v any) (int64, bool) {
	n, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	i, err := n.Int64()
	return i, err == nil
}

func cellText(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case json.Number:
		return x.String()
	default:
		return fmt.Sprint(x)
	}
}
