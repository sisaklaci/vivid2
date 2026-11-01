.class public Lhu/helmetsoft/vivid/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"


# instance fields
.field public web:Landroid/webkit/WebView;

.field public fileCb:Landroid/webkit/ValueCallback;


# direct methods
.method public constructor <init>()V
    .registers 1

    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method


# virtual methods
.method protected onCreate(Landroid/os/Bundle;)V
    .registers 8

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    # WebView
    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lhu/helmetsoft/vivid/MainActivity;->web:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    const/4 v3, 0x0
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setSupportZoom(Z)V
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V

    # file chooser support
    new-instance v1, Lhu/helmetsoft/vivid/Chrome;
    invoke-direct {v1, p0}, Lhu/helmetsoft/vivid/Chrome;-><init>(Lhu/helmetsoft/vivid/MainActivity;)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    # JS bridge: window.Android
    new-instance v1, Lhu/helmetsoft/vivid/Bridge;
    invoke-direct {v1, p0}, Lhu/helmetsoft/vivid/Bridge;-><init>(Lhu/helmetsoft/vivid/MainActivity;)V
    const-string v2, "Android"
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    # html = new String(readAll(getAssets().open("index.html")), UTF_8)
    invoke-virtual {p0}, Landroid/app/Activity;->getAssets()Landroid/content/res/AssetManager;
    move-result-object v1
    const-string v2, "index.html"
    invoke-virtual {v1, v2}, Landroid/content/res/AssetManager;->open(Ljava/lang/String;)Ljava/io/InputStream;
    move-result-object v1
    invoke-static {v1}, Lhu/helmetsoft/vivid/Bridge;->readAll(Ljava/io/InputStream;)[B
    move-result-object v1
    new-instance v2, Ljava/lang/String;
    sget-object v3, Ljava/nio/charset/StandardCharsets;->UTF_8:Ljava/nio/charset/Charset;
    invoke-direct {v2, v1, v3}, Ljava/lang/String;-><init>([BLjava/nio/charset/Charset;)V

    # web.loadDataWithBaseURL("https://vivid.local/", html, "text/html", "UTF-8", null)
    const-string v1, "https://vivid.local/"
    const-string v3, "text/html"
    const-string v4, "UTF-8"
    const/4 v5, 0x0
    invoke-virtual/range {v0 .. v5}, Landroid/webkit/WebView;->loadDataWithBaseURL(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V

    invoke-virtual {p0, v0}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V

    return-void
.end method

.method protected onActivityResult(IILandroid/content/Intent;)V
    .registers 6

    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V

    iget-object v0, p0, Lhu/helmetsoft/vivid/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    if-eqz v0, :end

    invoke-static {p2, p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;
    move-result-object v1
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    const/4 v1, 0x0
    iput-object v1, p0, Lhu/helmetsoft/vivid/MainActivity;->fileCb:Landroid/webkit/ValueCallback;

    :end
    return-void
.end method

.method public onBackPressed()V
    .registers 4

    iget-object v0, p0, Lhu/helmetsoft/vivid/MainActivity;->web:Landroid/webkit/WebView;
    if-nez v0, :has_web
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void

    :has_web
    const-string v1, "if(window.onAndroidBack){onAndroidBack()}else{Android.exitApp()}"
    const/4 v2, 0x0
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V
    return-void
.end method

.method protected onPause()V
    .registers 2

    invoke-super {p0}, Landroid/app/Activity;->onPause()V
    iget-object v0, p0, Lhu/helmetsoft/vivid/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :end
    invoke-virtual {v0}, Landroid/webkit/WebView;->onPause()V
    :end
    return-void
.end method

.method protected onResume()V
    .registers 2

    invoke-super {p0}, Landroid/app/Activity;->onResume()V
    iget-object v0, p0, Lhu/helmetsoft/vivid/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :end
    invoke-virtual {v0}, Landroid/webkit/WebView;->onResume()V
    :end
    return-void
.end method
