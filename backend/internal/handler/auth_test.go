package handler

import (
	"net/http"
	"testing"

	"nexttask/backend/internal/model"

	"github.com/golang-jwt/jwt/v5"
)

func TestRegister(t *testing.T) {
	e, db := newTaskTestServer(t)

	rec := performRequest(e, http.MethodPost, "/api/auth/register", `{
		"name":"Taro",
		"email":"TARO@example.com",
		"password":"password123"
	}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}

	body := decodeResponse(t, rec)
	if body["token"] == "" {
		t.Fatalf("token is empty: %#v", body)
	}

	userBody, ok := body["user"].(map[string]any)
	if !ok {
		t.Fatalf("user object is missing: %#v", body)
	}
	if userBody["email"] != "taro@example.com" {
		t.Fatalf("email = %v, want taro@example.com", userBody["email"])
	}
	if _, ok := userBody["password_hash"]; ok {
		t.Fatalf("password_hash should not be returned: %#v", userBody)
	}

	var user model.User
	if err := db.First(&user, "email = ?", "taro@example.com").Error; err != nil {
		t.Fatalf("find registered user: %v", err)
	}
	if user.PasswordHash == "" || user.PasswordHash == "password123" {
		t.Fatalf("password was not hashed")
	}

	claims := parseTestToken(t, body["token"].(string))
	if claims.UserID != user.ID {
		t.Fatalf("token user_id = %s, want %s", claims.UserID, user.ID)
	}
	if claims.Subject != user.ID {
		t.Fatalf("token subject = %s, want %s", claims.Subject, user.ID)
	}
}

func TestRegisterValidationAndDuplicateEmail(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{
			name: "missing name",
			body: `{"email":"taro@example.com","password":"password123"}`,
		},
		{
			name: "invalid email",
			body: `{"name":"Taro","email":"invalid","password":"password123"}`,
		},
		{
			name: "short password",
			body: `{"name":"Taro","email":"taro@example.com","password":"short"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e, _ := newTaskTestServer(t)
			rec := performRequest(e, http.MethodPost, "/api/auth/register", tt.body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
			if got := errorCode(t, rec); got != "validation_error" {
				t.Fatalf("error code = %s, want validation_error", got)
			}
		})
	}

	e, _ := newTaskTestServer(t)
	body := `{"name":"Taro","email":"taro@example.com","password":"password123"}`
	first := performRequest(e, http.MethodPost, "/api/auth/register", body)
	if first.Code != http.StatusCreated {
		t.Fatalf("first register status = %d, want %d, body: %s", first.Code, http.StatusCreated, first.Body.String())
	}
	second := performRequest(e, http.MethodPost, "/api/auth/register", body)
	if second.Code != http.StatusConflict {
		t.Fatalf("second register status = %d, want %d, body: %s", second.Code, http.StatusConflict, second.Body.String())
	}
	if got := errorCode(t, second); got != "email_already_exists" {
		t.Fatalf("error code = %s, want email_already_exists", got)
	}
}

func TestLogin(t *testing.T) {
	e, _ := newTaskTestServer(t)

	register := performRequest(e, http.MethodPost, "/api/auth/register", `{
		"name":"Taro",
		"email":"taro@example.com",
		"password":"password123"
	}`)
	if register.Code != http.StatusCreated {
		t.Fatalf("register status = %d, want %d, body: %s", register.Code, http.StatusCreated, register.Body.String())
	}

	login := performRequest(e, http.MethodPost, "/api/auth/login", `{
		"email":"taro@example.com",
		"password":"password123"
	}`)
	if login.Code != http.StatusOK {
		t.Fatalf("login status = %d, want %d, body: %s", login.Code, http.StatusOK, login.Body.String())
	}
	body := decodeResponse(t, login)
	if body["token"] == "" {
		t.Fatalf("token is empty: %#v", body)
	}
	parseTestToken(t, body["token"].(string))
}

func TestLoginInvalidCredentials(t *testing.T) {
	e, _ := newTaskTestServer(t)

	register := performRequest(e, http.MethodPost, "/api/auth/register", `{
		"name":"Taro",
		"email":"taro@example.com",
		"password":"password123"
	}`)
	if register.Code != http.StatusCreated {
		t.Fatalf("register status = %d, want %d, body: %s", register.Code, http.StatusCreated, register.Body.String())
	}

	tests := []struct {
		name string
		body string
	}{
		{
			name: "wrong password",
			body: `{"email":"taro@example.com","password":"wrongpassword"}`,
		},
		{
			name: "unknown email",
			body: `{"email":"unknown@example.com","password":"password123"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := performRequest(e, http.MethodPost, "/api/auth/login", tt.body)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want %d, body: %s", rec.Code, http.StatusUnauthorized, rec.Body.String())
			}
			if got := errorCode(t, rec); got != "invalid_credentials" {
				t.Fatalf("error code = %s, want invalid_credentials", got)
			}
		})
	}
}

func parseTestToken(t *testing.T, tokenString string) *authClaims {
	t.Helper()

	token, err := jwt.ParseWithClaims(tokenString, &authClaims{}, func(token *jwt.Token) (any, error) {
		return []byte("test-jwt-secret"), nil
	})
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	claims, ok := token.Claims.(*authClaims)
	if !ok || !token.Valid {
		t.Fatalf("token is invalid")
	}
	if claims.ExpiresAt == nil {
		t.Fatalf("token has no expiration")
	}
	return claims
}
