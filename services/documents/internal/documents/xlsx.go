package documents

import (
	"context"
	"fmt"

	"github.com/xuri/excelize/v2"
)

const (
	sheetName   = "Report"
	moneyFormat = 4 // built-in "#,##0.00"
)

// XLSXRenderer writes one sheet: a bold header row, then one row per record.
type XLSXRenderer struct{}

// Render writes money columns as numbers in major units so spreadsheets can sum them.
func (XLSXRenderer) Render(_ context.Context, c Content) ([]byte, error) {
	t := c.AsTable()
	f := excelize.NewFile()
	defer func() { _ = f.Close() }() // in-memory file, nothing to flush
	if err := f.SetSheetName("Sheet1", sheetName); err != nil {
		return nil, fmt.Errorf("name sheet: %w", err)
	}
	bold, err := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	if err != nil {
		return nil, fmt.Errorf("header style: %w", err)
	}
	money, err := f.NewStyle(&excelize.Style{NumFmt: moneyFormat})
	if err != nil {
		return nil, fmt.Errorf("money style: %w", err)
	}

	for i, col := range t.Columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		if err := f.SetCellValue(sheetName, cell, col.Label); err != nil {
			return nil, fmt.Errorf("write header: %w", err)
		}
		if err := f.SetCellStyle(sheetName, cell, cell, bold); err != nil {
			return nil, fmt.Errorf("style header: %w", err)
		}
	}
	for r, row := range t.Rows {
		for i, col := range t.Columns {
			cell, _ := excelize.CoordinatesToCellName(i+1, r+2)
			if col.Money {
				minor, _ := moneyCell(row[col.Key]) // validated when parsed
				if err := f.SetCellValue(sheetName, cell, float64(minor)/100); err != nil {
					return nil, fmt.Errorf("write money: %w", err)
				}
				if err := f.SetCellStyle(sheetName, cell, cell, money); err != nil {
					return nil, fmt.Errorf("style money: %w", err)
				}
				continue
			}
			if err := f.SetCellValue(sheetName, cell, cellText(row[col.Key])); err != nil {
				return nil, fmt.Errorf("write cell: %w", err)
			}
		}
	}
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, fmt.Errorf("xlsx output: %w", err)
	}
	return buf.Bytes(), nil
}
