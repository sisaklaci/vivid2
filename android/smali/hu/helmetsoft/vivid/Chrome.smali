.class public Lhu/helmetsoft/vivid/Chrome;
.super Landroid/webkit/WebChromeClient;
.source "Chrome.java"


# instance fields
.field private final act:Lhu/helmetsoft/vivid/MainActivity;


# direct methods
.method public constructor <init>(Lhu/helmetsoft/vivid/MainActivity;)V
    .registers 2

    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    iput-object p1, p0, Lhu/helmetsoft/vivid/Chrome;->act:Lhu/helmetsoft/vivid/MainActivity;

    return-void
.end method


# virtual methods
.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .registers 8

    iget-object v0, p0, Lhu/helmetsoft/vivid/Chrome;->act:Lhu/helmetsoft/vivid/MainActivity;

    # cancel a pending chooser, if any
    iget-object v1, v0, Lhu/helmetsoft/vivid/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    if-eqz v1, :no_pending
    const/4 v2, 0x0
    invoke-interface {v1, v2}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    :no_pending
    iput-object p2, v0, Lhu/helmetsoft/vivid/MainActivity;->fileCb:Landroid/webkit/ValueCallback;

    # Intent(ACTION_GET_CONTENT).addCategory(OPENABLE).setType("*/*")
    new-instance v1, Landroid/content/Intent;
    const-string v2, "android.intent.action.GET_CONTENT"
    invoke-direct {v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
    const-string v2, "android.intent.category.OPENABLE"
    invoke-virtual {v1, v2}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;
    const-string v2, "*/*"
    invoke-virtual {v1, v2}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;

    :try_start
    const/16 v2, 0x2a
    invoke-virtual {v0, v1, v2}, Landroid/app/Activity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end
    .catch Landroid/content/ActivityNotFoundException; {:try_start .. :try_end} :fail

    const/4 v2, 0x1
    return v2

    :fail
    const/4 v2, 0x0
    iput-object v2, v0, Lhu/helmetsoft/vivid/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    return v2
.end method
