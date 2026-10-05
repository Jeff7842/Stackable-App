package documents

import (
	"bytes"
	"context"
	"fmt"

	"github.com/go-pdf/fpdf"
)

const (
	pageMargin     = 15.0  // mm
	pageBottom     = 18.0  // mm kept free for the footer
	contentWidth   = 180.0 // A4 width minus both margins
	tableRowHeight = 7.0
)

// PDFRenderer draws A4 documents with a school-name header on every page.
type PDFRenderer struct {
	Uncompressed bool // tests turn compression off to look for text in the bytes
}

// Render draws a receipt layout for receipts and a table layout for everything else.
func (r PDFRenderer) Render(_ context.Context, c Content) ([]byte, error) {
	p := fpdf.New("P", "mm", "A4", "")
	p.SetCompression(!r.Uncompressed)
	p.SetMargins(pageMargin, pageMargin, pageMargin)
	p.SetAutoPageBreak(true, pageBottom)
	tr := p.UnicodeTranslatorFromDescriptor("") // core fonts are cp1252, so convert from UTF-8

	school := c.SchoolName()
	p.SetHeaderFunc(func() {
		p.SetFont("Helvetica", "B", 14)
		p.CellFormat(0, 8, tr(school), "", 1, "L", false, 0, "")
		p.Line(pageMargin, p.GetY(), pageMargin+contentWidth, p.GetY())
		p.Ln(4)
	})
	p.SetFooterFunc(func() {
		p.SetY(-12)
		p.SetFont("Helvetica", "", 8)
		p.CellFormat(0, 6, fmt.Sprintf("Page %d of {nb}", p.PageNo()), "", 0, "C", false, 0, "")
	})
	p.AliasNbPages("")
	p.AddPage()

	if c.Receipt != nil {
		drawReceipt(p, tr, *c.Receipt)
	} else {
		drawTable(p, tr, *c.Table)
	}

	var buf bytes.Buffer
	if err := p.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf output: %w", err)
	}
	return buf.Bytes(), nil
}

func drawReceipt(p *fpdf.Fpdf, tr func(string) string, r ReceiptData) {
	p.SetFont("Helvetica", "B", 18)
	p.CellFormat(0, 10, "RECEIPT", "", 1, "L", false, 0, "")
	p.SetFont("Helvetica", "", 10)
	for _, kv := range [][2]string{{"Receipt no", r.ReceiptNo}, {"Received from", r.PayerName}, {"Date", r.IssuedAt}} {
		if kv[1] == "" {
			continue
		}
		p.CellFormat(35, 6, kv[0], "", 0, "L", false, 0, "")
		p.CellFormat(0, 6, tr(kv[1]), "", 1, "L", false, 0, "")
	}
	p.Ln(4)

	const descW, amountW = 120.0, 60.0
	p.SetFont("Helvetica", "B", 10)
	p.SetFillColor(230, 230, 230)
	p.CellFormat(descW, tableRowHeight, "Description", "1", 0, "L", true, 0, "")
	p.CellFormat(amountW, tableRowHeight, "Amount", "1", 1, "R", true, 0, "")
	p.SetFont("Helvetica", "", 10)
	for _, l := range r.Lines {
		p.CellFormat(descW, tableRowHeight, tr(fit(p, l.Description, descW)), "1", 0, "L", false, 0, "")
		p.CellFormat(amountW, tableRowHeight, FormatKES(l.AmountMinor), "1", 1, "R", false, 0, "")
	}
	p.SetFont("Helvetica", "B", 11)
	p.CellFormat(descW, tableRowHeight+1, "Total", "1", 0, "L", false, 0, "")
	p.CellFormat(amountW, tableRowHeight+1, FormatKES(r.Total()), "1", 1, "R", false, 0, "")
}

func drawTable(p *fpdf.Fpdf, tr func(string) string, t TableData) {
	if t.Title != "" {
		p.SetFont("Helvetica", "B", 13)
		p.CellFormat(0, 9, tr(t.Title), "", 1, "L", false, 0, "")
	}
	colW := contentWidth / float64(len(t.Columns))
	_, pageH := p.GetPageSize()

	header := func() {
		p.SetFont("Helvetica", "B", 9)
		p.SetFillColor(230, 230, 230)
		for _, c := range t.Columns {
			p.CellFormat(colW, tableRowHeight, tr(fit(p, c.Label, colW)), "1", 0, "L", true, 0, "")
		}
		p.Ln(-1)
		p.SetFont("Helvetica", "", 9)
	}
	header()
	for _, row := range t.Rows {
		if p.GetY()+tableRowHeight > pageH-pageBottom {
			p.AddPage()
			header()
		}
		for _, c := range t.Columns {
			if c.Money {
				amount, _ := moneyCell(row[c.Key]) // validated when parsed
				p.CellFormat(colW, tableRowHeight, FormatKES(amount), "1", 0, "R", false, 0, "")
				continue
			}
			p.CellFormat(colW, tableRowHeight, tr(fit(p, cellText(row[c.Key]), colW)), "1", 0, "L", false, 0, "")
		}
		p.Ln(-1)
	}
}

// fit trims text so it stays inside its cell instead of overlapping the next column.
func fit(p *fpdf.Fpdf, s string, w float64) string {
	limit := w - 2 // cell padding
	if p.GetStringWidth(s) <= limit {
		return s
	}
	runes := []rune(s)
	for len(runes) > 0 && p.GetStringWidth(string(runes)+"...") > limit {
		runes = runes[:len(runes)-1]
	}
	return string(runes) + "..."
}
