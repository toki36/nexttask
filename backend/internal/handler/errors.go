package handler

import "github.com/labstack/echo/v4"

func errorResponse(c echo.Context, status int, code string, message string) error {
	return c.JSON(status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
