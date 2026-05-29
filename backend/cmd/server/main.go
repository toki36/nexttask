package main

import (
	"log"

	"nexttask/backend/internal/config"
	"nexttask/backend/internal/handler"
	"nexttask/backend/internal/repository"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	cfg := config.Load()

	db, err := repository.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}

	if err := repository.Migrate(db); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	e := echo.New()
	e.HideBanner = true
	e.HTTPErrorHandler = handler.HTTPErrorHandler
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: cfg.CORSAllowOrigins,
		AllowMethods: []string{echo.GET, echo.POST, echo.PATCH, echo.DELETE, echo.OPTIONS},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))

	handler.RegisterRoutes(e, db, cfg.JWTSecret)

	e.Logger.Fatal(e.Start(":" + cfg.Port))
}
