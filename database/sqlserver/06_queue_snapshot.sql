USE [ArcEdge Queue];
GO

IF OBJECT_ID(N'[ops].[QueueSnapshot]', N'U') IS NULL
BEGIN
  CREATE TABLE [ops].[QueueSnapshot](
    [SingletonKey] CHAR(1) NOT NULL CONSTRAINT [PK_QueueSnapshot] PRIMARY KEY,
    [PayloadJson] NVARCHAR(MAX) NOT NULL,
    [Rev] BIGINT NOT NULL,
    [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_QueueSnapshot_UpdatedAt] DEFAULT (SYSUTCDATETIME())
  );
END;
GO
