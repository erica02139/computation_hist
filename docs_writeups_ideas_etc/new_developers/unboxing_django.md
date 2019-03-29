# Unboxing Django

Getting Django up and running requires a few unboxing steps.

Open a terminal in the computation_hist main directory. In PyCharm, click on
"Terminal" on the bottom left side. Once, there, apply all database migrations.

```
python manage.py migrate
```

Next, we populate the database with our metadata. To do this, open a Django shell:
```
python manage.py shell
```
In the Django shell, run the following commands.
```
from utilites.metadata_parser import populate_from_metadata
populate_from_metadata()
```
Unless you are populating from a metadata that is different from metadata.csv, do not pass in a 
parameter (the function will assume the path to metadata.csv as default)

Once the process has finished (it might take a few minutes), exit the Django shell
``` 
quit()
```

You are now ready to run the development server
```
python manage.py runserver
```

You can now access either the website itself at [http://127.0.0.1:8000/](http://127.0.0.1:8000/).


#### Documentation

Django has excellent [documentation](https://docs.djangoproject.com/en/2.1/). Please 
read the [overview](https://docs.djangoproject.com/en/2.1/intro/overview/) before 
getting started.


#### (Optional) Create a super user to access the admin interface
```
python manage.py createsuperuser
```
Creating a super user gives you access to Django's extensive admin interface at 
[http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/).
This is not required but useful.