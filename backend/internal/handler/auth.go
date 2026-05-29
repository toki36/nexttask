package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"nexttask/backend/internal/model"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const authTokenTTL = 24 * time.Hour

type authRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string     `json:"token"`
	User  model.User `json:"user"`
}

type authClaims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

func (h *Handler) Register(c echo.Context) error {
	req, err := bindRegisterRequest(c)
	if err != nil {
		return err
	}

	var existing model.User
	err = h.db.First(&existing, "email = ?", req.Email).Error
	if err == nil {
		return errorResponse(c, http.StatusConflict, "email_already_exists", "email already exists")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	id, err := newID()
	if err != nil {
		return err
	}

	user := model.User{
		ID:           id,
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(passwordHash),
	}
	if err := h.db.Create(&user).Error; err != nil {
		return err
	}

	token, err := h.issueToken(user.ID)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusCreated, authResponse{Token: token, User: user})
}

func (h *Handler) Login(c echo.Context) error {
	req, err := bindLoginRequest(c)
	if err != nil {
		return err
	}

	var user model.User
	if err := h.db.First(&user, "email = ?", req.Email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errorResponse(c, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		}
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return errorResponse(c, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
	}

	token, err := h.issueToken(user.ID)
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, authResponse{Token: token, User: user})
}

func bindRegisterRequest(c echo.Context) (authRequest, error) {
	var req authRequest
	if err := c.Bind(&req); err != nil {
		return req, errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = normalizeEmail(req.Email)
	if req.Name == "" {
		return req, errorResponse(c, http.StatusBadRequest, "validation_error", "name is required")
	}
	if err := validateAuthCredentials(c, req.Email, req.Password); err != nil {
		return req, err
	}
	return req, nil
}

func bindLoginRequest(c echo.Context) (authRequest, error) {
	var req authRequest
	if err := c.Bind(&req); err != nil {
		return req, errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	req.Email = normalizeEmail(req.Email)
	if err := validateAuthCredentials(c, req.Email, req.Password); err != nil {
		return req, err
	}
	return req, nil
}

func validateAuthCredentials(c echo.Context, email string, password string) error {
	if email == "" {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "email is required")
	}
	if !strings.Contains(email, "@") {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "email must be valid")
	}
	if len(password) < 8 {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "password must be at least 8 characters")
	}
	return nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func (h *Handler) issueToken(userID string) (string, error) {
	now := time.Now()
	claims := authClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(authTokenTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(h.jwtSecret)
}
