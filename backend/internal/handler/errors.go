package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type apiError struct {
	status  int
	code    string
	message string
}

func (e apiError) Error() string {
	return e.message
}

func errorResponse(_ echo.Context, status int, code string, message string) error {
	return apiError{
		status:  status,
		code:    code,
		message: message,
	}
}

func HTTPErrorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}

	if apiErr, ok := err.(apiError); ok {
		if writeErr := writeError(c, apiErr.status, apiErr.code, apiErr.message); writeErr != nil {
			c.Logger().Error(writeErr)
		}
		return
	}

	httpErr, ok := err.(*echo.HTTPError)
	if !ok {
		if writeErr := writeError(c, http.StatusInternalServerError, "internal_error", "internal server error"); writeErr != nil {
			c.Logger().Error(writeErr)
		}
		c.Logger().Error(err)
		return
	}

	message, ok := httpErr.Message.(string)
	if !ok {
		message = http.StatusText(httpErr.Code)
	}
	if writeErr := writeError(c, httpErr.Code, "http_error", message); writeErr != nil {
		c.Logger().Error(writeErr)
	}
}

func writeError(c echo.Context, status int, code string, message string) error {
	return c.JSON(status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
