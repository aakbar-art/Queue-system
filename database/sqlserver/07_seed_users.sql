USE [ArcEdge Queue];
GO

IF NOT EXISTS (SELECT 1 FROM [auth].[AppUser] WHERE Username = 'admin')
BEGIN
    DECLARE @AdminId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO [auth].[AppUser] (Id, Username, PasswordHash, FullName, Active) 
    VALUES (@AdminId, 'admin', '$2b$10$Zr8GSu7QuyR5KWgYZUwwq.PAjNxoJTpeHiI8JzuJoJ.aM/fKqHytq', 'Queue Administrator', 1);
    INSERT INTO [auth].[AppUserRole] (UserId, Role) VALUES (@AdminId, 'admin');
END

IF NOT EXISTS (SELECT 1 FROM [auth].[AppUser] WHERE Username = 'front')
BEGIN
    DECLARE @FrontId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO [auth].[AppUser] (Id, Username, PasswordHash, FullName, Active)
    VALUES (@FrontId, 'front', '$2b$10$t81F37kP3m1JughssWThd.QgGsxUygxdxKO5j1HrL2DRUxD3iNvL.', 'Front Desk', 1);
    INSERT INTO [auth].[AppUserRole] (UserId, Role) VALUES (@FrontId, 'front_desk');
END

IF NOT EXISTS (SELECT 1 FROM [auth].[AppUser] WHERE Username = 'doctor')
BEGIN
    DECLARE @DoctorId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO [auth].[AppUser] (Id, Username, PasswordHash, FullName, Active)
    VALUES (@DoctorId, 'doctor', '$2b$10$9tkOvcg5TJlwIM2RJFskKehDWSIqBac9HJWdAKX90wsoes342EPli', 'Dr. Counter', 1);
    INSERT INTO [auth].[AppUserRole] (UserId, Role) VALUES (@DoctorId, 'doctor');
    
    -- Also seed the doctor profile to match the doctor user
    IF NOT EXISTS (SELECT 1 FROM [ops].[Doctor] WHERE UserId = @DoctorId)
    BEGIN
        INSERT INTO [ops].[Doctor] (Id, UserId, FullName, Specialty, Bio)
        VALUES (NEWID(), @DoctorId, 'Dr. Counter', 'General', 'Seeded');
    END
END
GO
