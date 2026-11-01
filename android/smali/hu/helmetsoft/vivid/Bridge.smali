.class public Lhu/helmetsoft/vivid/Bridge;
.super Ljava/lang/Object;
.source "Bridge.java"


# instance fields
.field private final act:Lhu/helmetsoft/vivid/MainActivity;


# direct methods
.method public constructor <init>(Lhu/helmetsoft/vivid/MainActivity;)V
    .registers 2

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lhu/helmetsoft/vivid/Bridge;->act:Lhu/helmetsoft/vivid/MainActivity;

    return-void
.end method

.method public static readAll(Ljava/io/InputStream;)[B
    .registers 6

    new-instance v0, Ljava/io/ByteArrayOutputStream;
    invoke-direct {v0}, Ljava/io/ByteArrayOutputStream;-><init>()V
    const/16 v1, 0x2000
    new-array v1, v1, [B

    :loop
    invoke-virtual {p0, v1}, Ljava/io/InputStream;->read([B)I
    move-result v2
    if-ltz v2, :done
    const/4 v3, 0x0
    invoke-virtual {v0, v1, v3, v2}, Ljava/io/ByteArrayOutputStream;->write([BII)V
    goto :loop

    :done
    invoke-virtual {p0}, Ljava/io/InputStream;->close()V
    invoke-virtual {v0}, Ljava/io/ByteArrayOutputStream;->toByteArray()[B
    move-result-object v0
    return-object v0
.end method

# <filesDir>/scenes, created on demand
.method private dir()Ljava/io/File;
    .registers 4

    iget-object v0, p0, Lhu/helmetsoft/vivid/Bridge;->act:Lhu/helmetsoft/vivid/MainActivity;
    invoke-virtual {v0}, Landroid/content/ContextWrapper;->getFilesDir()Ljava/io/File;
    move-result-object v1
    new-instance v0, Ljava/io/File;
    const-string v2, "scenes"
    invoke-direct {v0, v1, v2}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
    invoke-virtual {v0}, Ljava/io/File;->mkdirs()Z
    return-object v0
.end method

# File for a plain file name, or null if the name is unsafe
.method private file(Ljava/lang/String;)Ljava/io/File;
    .registers 5

    if-eqz p1, :bad
    invoke-virtual {p1}, Ljava/lang/String;->isEmpty()Z
    move-result v0
    if-nez v0, :bad
    const-string v0, "/"
    invoke-virtual {p1, v0}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v0
    if-nez v0, :bad
    const-string v0, "\\"
    invoke-virtual {p1, v0}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v0
    if-nez v0, :bad
    const-string v0, ".."
    invoke-virtual {p1, v0}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v0
    if-nez v0, :bad

    invoke-direct {p0}, Lhu/helmetsoft/vivid/Bridge;->dir()Ljava/io/File;
    move-result-object v1
    new-instance v0, Ljava/io/File;
    invoke-direct {v0, v1, p1}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V
    return-object v0

    :bad
    const/4 v0, 0x0
    return-object v0
.end method

# MediaStore insert + write; returns "relPath/name" or null
.method private writeMedia(Landroid/net/Uri;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;[B)Ljava/lang/String;
    .registers 10

    new-instance v0, Landroid/content/ContentValues;
    invoke-direct {v0}, Landroid/content/ContentValues;-><init>()V
    const-string v1, "_display_name"
    invoke-virtual {v0, v1, p3}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V
    const-string v1, "mime_type"
    invoke-virtual {v0, v1, p4}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V
    const-string v1, "relative_path"
    invoke-virtual {v0, v1, p2}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V

    iget-object v1, p0, Lhu/helmetsoft/vivid/Bridge;->act:Lhu/helmetsoft/vivid/MainActivity;
    invoke-virtual {v1}, Landroid/content/ContextWrapper;->getContentResolver()Landroid/content/ContentResolver;
    move-result-object v1
    invoke-virtual {v1, p1, v0}, Landroid/content/ContentResolver;->insert(Landroid/net/Uri;Landroid/content/ContentValues;)Landroid/net/Uri;
    move-result-object v2
    if-eqz v2, :fail
    invoke-virtual {v1, v2}, Landroid/content/ContentResolver;->openOutputStream(Landroid/net/Uri;)Ljava/io/OutputStream;
    move-result-object v3
    if-eqz v3, :fail
    invoke-virtual {v3, p5}, Ljava/io/OutputStream;->write([B)V
    invoke-virtual {v3}, Ljava/io/OutputStream;->close()V

    new-instance v0, Ljava/lang/StringBuilder;
    invoke-direct {v0}, Ljava/lang/StringBuilder;-><init>()V
    invoke-virtual {v0, p2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    const-string v1, "/"
    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v0, p3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
    move-result-object v0
    return-object v0

    :fail
    const/4 v0, 0x0
    return-object v0
.end method


# virtual methods (JavaScript interface)
.method public listFiles()Ljava/lang/String;
    .registers 4
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start
    invoke-direct {p0}, Lhu/helmetsoft/vivid/Bridge;->dir()Ljava/io/File;
    move-result-object v0
    invoke-virtual {v0}, Ljava/io/File;->list()[Ljava/lang/String;
    move-result-object v0
    if-nez v0, :have
    const/4 v1, 0x0
    new-array v0, v1, [Ljava/lang/String;
    :have
    new-instance v1, Lorg/json/JSONArray;
    invoke-direct {v1, v0}, Lorg/json/JSONArray;-><init>(Ljava/lang/Object;)V
    invoke-virtual {v1}, Lorg/json/JSONArray;->toString()Ljava/lang/String;
    move-result-object v0
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :fail
    return-object v0

    :fail
    const-string v0, "[]"
    return-object v0
.end method

.method public readFile(Ljava/lang/String;)Ljava/lang/String;
    .registers 6
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    invoke-direct {p0, p1}, Lhu/helmetsoft/vivid/Bridge;->file(Ljava/lang/String;)Ljava/io/File;
    move-result-object v0
    if-eqz v0, :fail
    invoke-virtual {v0}, Ljava/io/File;->isFile()Z
    move-result v1
    if-eqz v1, :fail

    :try_start
    new-instance v1, Ljava/io/FileInputStream;
    invoke-direct {v1, v0}, Ljava/io/FileInputStream;-><init>(Ljava/io/File;)V
    invoke-static {v1}, Lhu/helmetsoft/vivid/Bridge;->readAll(Ljava/io/InputStream;)[B
    move-result-object v1
    new-instance v2, Ljava/lang/String;
    sget-object v3, Ljava/nio/charset/StandardCharsets;->UTF_8:Ljava/nio/charset/Charset;
    invoke-direct {v2, v1, v3}, Ljava/lang/String;-><init>([BLjava/nio/charset/Charset;)V
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :fail
    return-object v2

    :fail
    const/4 v0, 0x0
    return-object v0
.end method

.method public writeFile(Ljava/lang/String;Ljava/lang/String;)Z
    .registers 7
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    invoke-direct {p0, p1}, Lhu/helmetsoft/vivid/Bridge;->file(Ljava/lang/String;)Ljava/io/File;
    move-result-object v0
    if-eqz v0, :fail
    if-eqz p2, :fail

    :try_start
    sget-object v1, Ljava/nio/charset/StandardCharsets;->UTF_8:Ljava/nio/charset/Charset;
    invoke-virtual {p2, v1}, Ljava/lang/String;->getBytes(Ljava/nio/charset/Charset;)[B
    move-result-object v1
    new-instance v2, Ljava/io/FileOutputStream;
    invoke-direct {v2, v0}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V
    invoke-virtual {v2, v1}, Ljava/io/FileOutputStream;->write([B)V
    invoke-virtual {v2}, Ljava/io/FileOutputStream;->close()V
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :fail

    const/4 v0, 0x1
    return v0

    :fail
    const/4 v0, 0x0
    return v0
.end method

.method public deleteFile(Ljava/lang/String;)Z
    .registers 4
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    invoke-direct {p0, p1}, Lhu/helmetsoft/vivid/Bridge;->file(Ljava/lang/String;)Ljava/io/File;
    move-result-object v0
    if-eqz v0, :fail
    invoke-virtual {v0}, Ljava/io/File;->delete()Z
    move-result v1
    return v1

    :fail
    const/4 v1, 0x0
    return v1
.end method

.method public saveImage(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
    .registers 9
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    :try_start
    const/4 v0, 0x0
    invoke-static {p2, v0}, Landroid/util/Base64;->decode(Ljava/lang/String;I)[B
    move-result-object v5
    move-object v0, p0
    sget-object v1, Landroid/provider/MediaStore$Images$Media;->EXTERNAL_CONTENT_URI:Landroid/net/Uri;
    const-string v2, "Pictures/Vivid"
    move-object v3, p1
    const-string v4, "image/png"
    invoke-direct/range {v0 .. v5}, Lhu/helmetsoft/vivid/Bridge;->writeMedia(Landroid/net/Uri;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;[B)Ljava/lang/String;
    move-result-object v0
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :fail
    return-object v0

    :fail
    const/4 v0, 0x0
    return-object v0
.end method

.method public exportText(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
    .registers 9
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    if-eqz p2, :fail
    :try_start
    sget-object v0, Ljava/nio/charset/StandardCharsets;->UTF_8:Ljava/nio/charset/Charset;
    invoke-virtual {p2, v0}, Ljava/lang/String;->getBytes(Ljava/nio/charset/Charset;)[B
    move-result-object v5
    move-object v0, p0
    sget-object v1, Landroid/provider/MediaStore$Downloads;->EXTERNAL_CONTENT_URI:Landroid/net/Uri;
    const-string v2, "Download/Vivid"
    move-object v3, p1
    const-string v4, "application/octet-stream"
    invoke-direct/range {v0 .. v5}, Lhu/helmetsoft/vivid/Bridge;->writeMedia(Landroid/net/Uri;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;[B)Ljava/lang/String;
    move-result-object v0
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :fail
    return-object v0

    :fail
    const/4 v0, 0x0
    return-object v0
.end method

.method public exitApp()V
    .registers 2
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    iget-object v0, p0, Lhu/helmetsoft/vivid/Bridge;->act:Lhu/helmetsoft/vivid/MainActivity;
    invoke-virtual {v0}, Landroid/app/Activity;->finish()V
    return-void
.end method
