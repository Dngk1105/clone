import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { register, login, authMiddleware, AuthenticatedRequest } from "./auth";
import { 
  insertExerciseSessionSchema,
  insertMoodEntrySchema,
  insertChatConversationSchema,
  insertAppointmentSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post('/api/register', register);
  app.post('/api/login', login);

  // Get current user route
  app.get('/api/user', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Exercise session routes
  app.post('/api/exercise-sessions', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const sessionData = insertExerciseSessionSchema.parse({
        ...req.body,
        userId,
      });
      
      const session = await storage.createExerciseSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error creating exercise session:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid exercise session data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create exercise session" });
    }
  });

  app.get('/api/exercise-sessions', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const sessions = await storage.getUserExerciseSessions(userId, limit);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching exercise sessions:", error);
      res.status(500).json({ message: "Failed to fetch exercise sessions" });
    }
  });

  // Mood tracking routes
  app.post('/api/mood-entries', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const moodData = insertMoodEntrySchema.parse({
        ...req.body,
        userId,
      });
      
      const moodEntry = await storage.createMoodEntry(moodData);
      res.json(moodEntry);
    } catch (error) {
      console.error("Error creating mood entry:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid mood entry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create mood entry" });
    }
  });

  app.get('/api/mood-entries', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const entries = await storage.getUserMoodEntries(userId, limit);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching mood entries:", error);
      res.status(500).json({ message: "Failed to fetch mood entries" });
    }
  });

  app.get('/api/mood-entries/latest', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const entry = await storage.getLatestMoodEntry(userId);
      res.json(entry || null);
    } catch (error) {
      console.error("Error fetching latest mood entry:", error);
      res.status(500).json({ message: "Failed to fetch latest mood entry" });
    }
  });

  // Chat conversation routes
  app.post('/api/chat/conversations', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const conversationData = insertChatConversationSchema.parse({
        ...req.body,
        userId,
      });
      
      const conversation = await storage.createChatConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      console.error("Error creating chat conversation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid conversation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.put('/api/chat/conversations/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { messages } = req.body;
      
      const conversation = await storage.updateChatConversation(conversationId, messages);
      res.json(conversation);
    } catch (error) {
      console.error("Error updating chat conversation:", error);
      res.status(500).json({ message: "Failed to update conversation" });
    }
  });

  app.get('/api/chat/conversations', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const conversations = await storage.getUserChatConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching chat conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get('/api/chat/conversations/latest', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const conversation = await storage.getLatestChatConversation(userId);
      res.json(conversation || null);
    } catch (error) {
      console.error("Error fetching latest conversation:", error);
      res.status(500).json({ message: "Failed to fetch latest conversation" });
    }
  });

  // Progress tracking routes
  app.get('/api/progress', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const progress = await storage.getUserProgress(userId);
      res.json(progress || null);
    } catch (error) {
      console.error("Error fetching user progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.put('/api/progress', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const progressData = req.body;
      
      const progress = await storage.updateUserProgress(userId, progressData);
      res.json(progress);
    } catch (error) {
      console.error("Error updating user progress:", error);
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Appointment routes
  app.post('/api/appointments', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const appointmentData = insertAppointmentSchema.parse({
        ...req.body,
        userId,
      });
      
      const appointment = await storage.createAppointment(appointmentData);
      res.json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.get('/api/appointments', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const appointments = await storage.getUserAppointments(userId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.put('/api/appointments/:id/status', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const { status } = req.body;
      
      const appointment = await storage.updateAppointmentStatus(appointmentId, status);
      res.json(appointment);
    } catch (error) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({ message: "Failed to update appointment status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
