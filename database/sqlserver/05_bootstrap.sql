USE [ArcEdge Queue];
GO

IF NOT EXISTS (SELECT 1 FROM [config].[Clinic])
  INSERT INTO [config].[Clinic] ([PortalKey], [Name], [ClinicType], [Currency], [TicketPrefix])
  VALUES ('clinic-1', N'Demo Clinic', N'general', N'USD', N'A');

IF NOT EXISTS (SELECT 1 FROM [ops].[QueueRuntime])
  INSERT INTO [ops].[QueueRuntime] ([PortalKey], [NextTicketNumber], [ReceiptSequence], [Paused])
  VALUES ('runtime-1', 1, 100, 0);
GO
