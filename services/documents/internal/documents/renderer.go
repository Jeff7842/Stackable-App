package documents

import "context"

// Renderer turns validated content into file bytes for one format.
type Renderer interface {
	Render(ctx context.Context, c Content) ([]byte, error)
}

// contentType maps a format to its MIME type for storage and downloads.
func contentType(f Format) string {
	if f == FormatXLSX {
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	}
	return "application/pdf"
}
