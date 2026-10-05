package kit

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	serviceTokenSecretEnv = "SERVICE_TOKEN_SECRET"
	tokenLeeway           = 5 * time.Second // tolerates small clock drift between services
)

// ServiceClaims are the verified claims of a service token.
type ServiceClaims struct {
	SchoolID string `json:"schoolId"`
	jwt.RegisteredClaims
}

// ServiceTokenVerifier checks HS256 service tokens for one issuer and audience.
type ServiceTokenVerifier struct {
	secret   []byte
	issuer   string
	audience string
}

// NewServiceTokenVerifier refuses an empty secret so there is never a fallback key.
func NewServiceTokenVerifier(secret, issuer, audience string) (*ServiceTokenVerifier, error) {
	if secret == "" {
		return nil, errors.New("service token secret is not set")
	}
	return &ServiceTokenVerifier{secret: []byte(secret), issuer: issuer, audience: audience}, nil
}

// NewServiceTokenVerifierFromEnv reads SERVICE_TOKEN_SECRET and fails if it is unset.
func NewServiceTokenVerifierFromEnv(issuer, audience string) (*ServiceTokenVerifier, error) {
	return NewServiceTokenVerifier(os.Getenv(serviceTokenSecretEnv), issuer, audience)
}

// Verify parses a token and returns its claims, or an Unauthorized error.
func (v *ServiceTokenVerifier) Verify(token string) (*ServiceClaims, error) {
	claims := &ServiceClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (any, error) { return v.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.audience),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(tokenLeeway),
	)
	if err != nil || claims.Subject == "" || claims.SchoolID == "" {
		return nil, Unauthorized("Invalid or expired service token.")
	}
	return claims, nil
}

// SignServiceToken creates a token for callers and tests.
func SignServiceToken(secret string, claims ServiceClaims) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

const claimsKey ctxKey = "serviceClaims"

// ClaimsFrom returns the verified service claims stored by RequireServiceToken.
func ClaimsFrom(ctx context.Context) (*ServiceClaims, bool) {
	c, ok := ctx.Value(claimsKey).(*ServiceClaims)
	return c, ok
}

// RequireServiceToken rejects requests without a valid bearer service token.
func RequireServiceToken(v *ServiceTokenVerifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw, found := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
			if !found || raw == "" {
				WriteError(w, r, Unauthorized("Missing service token."))
				return
			}
			claims, err := v.Verify(raw)
			if err != nil {
				WriteError(w, r, err)
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsKey, claims)))
		})
	}
}
