package handler

import (
	"gorm.io/gorm"

	"github.com/labstack/echo/v4"
)

func RegisterRoutes(e *echo.Echo, db *gorm.DB, jwtSecret string) {
	h := New(db, jwtSecret)

	e.GET("/health", h.Health)

	api := e.Group("/api")
	api.POST("/auth/register", h.Register)
	api.POST("/auth/login", h.Login)

	api.GET("/task-groups", h.ListTaskGroups)
	api.POST("/task-groups", h.CreateTaskGroup)
	api.PATCH("/task-groups/:id", h.UpdateTaskGroup)
	api.DELETE("/task-groups/:id", h.DeleteTaskGroup)

	api.GET("/tasks", h.ListTasks)
	api.POST("/tasks", h.CreateTask)
	api.PATCH("/tasks/:id", h.UpdateTask)
	api.DELETE("/tasks/:id", h.DeleteTask)

	api.GET("/export/ics", h.ExportICS)
}
