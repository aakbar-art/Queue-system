USE [ArcEdge Queue];
GO

CREATE OR ALTER FUNCTION [ops].[fn_FormatTicketCode](@Prefix NVARCHAR(8), @Number INT)
RETURNS NVARCHAR(20)
AS BEGIN
  RETURN @Prefix + N'-' + RIGHT(N'000' + CAST(@Number AS NVARCHAR(8)), 3);
END;
GO

CREATE OR ALTER PROCEDURE [ops].[sp_SetQueuePaused]
  @Paused BIT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE [ops].[QueueRuntime] SET [Paused] = @Paused;
END;
GO

CREATE OR ALTER PROCEDURE [auth].[sp_GetUserByUsername]
  @Username NVARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT u.[Id], u.[Username], u.[PasswordHash], u.[FullName], u.[Active]
  FROM [auth].[AppUser] u
  WHERE u.[Username] = @Username;
END;
GO
