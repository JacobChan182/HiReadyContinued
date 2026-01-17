class Config:
    DEBUG = False
    TESTING = False
    # add secrets or environment-driven configs here

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
