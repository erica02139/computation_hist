import urllib.request, urllib.error
import shutil
import sys
from IPython import embed
import os
from pathlib import Path, PurePath, PurePosixPath
from django.db import models
#from computation_hist.common import make_searchable_pdf
from dj_comp_hist.models import Folder
from dj_comp_hist.common import get_file_path, DATA_BASE_PATH
from PyPDF2 import PdfFileWriter, PdfFileReader
from pdf2image import convert_from_path


def main_function(test_run=True):
    # ----- go through each folder in the database
        # right now we are setting box,folder,foldername
    folder_list = Folder.objects.all()

    if test_run:
        folder_list = folder_list[:1]

    print(folder_list)

    for current_folder in folder_list:
        box_id = current_folder.box.number
        folder_id = current_folder.number
        foldername_short = current_folder.name
        # place it in the correct folder creating it if neccessary

        path_to_folder = download_raw_folder_pdf_from_aws(box_id, folder_id, foldername_short)
        print(path_to_folder)
        # for each folder - split into documents, for each document - split the document into pages
        #TODO: is this the correct name of the PDF
        split_folder_to_doc(path_to_folder.parent.parent, path_to_folder, foldername_short, box_id,
                            folder_id)

def download_raw_folder_pdf_from_aws(box:int, folder:int, foldername:str):
    '''
    Downloads a raw (not yet ocred) pdf file from amazon aws and stores it in the proper folder
    relative to DATA_BASE_PATH

    :return: Path
    '''
    rel_path = get_file_path(box, folder, foldername, file_type='raw_pdf')
    abs_path = Path(DATA_BASE_PATH, rel_path)
    # SR: I was worried about using str(Path) on Windows systems, hence the awkward "/".join()
    url = f'https://s3.amazonaws.com/comp-hist/docs/{"/".join(rel_path.parts)}'
    try:
        with urllib.request.urlopen(url) as response:
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            with open(abs_path, 'wb') as pdf_file:
                shutil.copyfileobj(response, pdf_file)
    except urllib.error.HTTPError:
        raise(FileNotFoundError(f'{url} is not available from our AWS bucket. For a list of '
                                     f'available files, see aws_available_files.md in the '
                                     f'computation_hist/data directory.'))
    return abs_path


def create_sub_directories(path_to_folder, foldername_short='rockefeller'):
    """
    take in a folder, split into documents, as you split into documents, take the document and
    split into pages
    for each folder - split into documents, for each document - split the document into page

    To run this code :
    sys.path
    import sys
    sys.path.insert(0, '/Users/ifeademolu-odeneye/Documents/GitHub/computation_hist
    /computation_hist') - replace with your file path
    import dj_comp_hist
    from  dj_comp_hist import models
    import sys
    sys.path.insert(0, '/Users/ifeademolu-odeneye/Documents/GitHub/computation_hist
     /computation_hist')
    import sort_pdfs
    sort_pdfs.create_sub_folders(sort_pdfs.path_to_boxes, "rockefeller")

    :return:
    """
    pass


def split_doc_to_page(pdf_path, foldername_short, box_no, folder_no, doc_no):
   print("********************")
   # ------------------to be changed next line
   print(pdf_path)
   pages = convert_from_path(pdf_path)

   for page in range(1, len(pages)+1):
       x = get_file_path(box_no, folder_no, foldername_short, file_type='png', doc_id=doc_no,
                         page_id=page, path_type='absolute')
       x.parent.mkdir(parents=True, exist_ok=True)
       print(x)
       pages[page-1].save(x, 'PNG')#saves page to the directory


def split_folder_to_doc(folder_location,pdf_path, foldername_short, box, folderno):
    """

    :param pdf_path: the path up to the folder containing the pdfs
    :param associated_documents:
    :return:
    """
    start_pages = []
    associated_documents = Folder.objects.get(name=foldername_short).document_set.all()
    for single_doc in associated_documents:
        start_pages.append(single_doc.first_page)
        list.sort(start_pages)
    folder_pdf = PdfFileReader(open(pdf_path, "rb"))
    for doc in associated_documents:
        get_file_path(box, folderno, foldername_short, file_type='pdf', doc_id=doc.id,
                      path_type='absolute'
                      ).parent.mkdir(parents=True, exist_ok=True)
        #if not os.path.exists(PurePath.joinpath(pdf_location, "doc_" + str(doc.id))):
        #    Path.mkdir(PurePath.joinpath(pdf_path, "doc_" + str(doc.id)))
        output = PdfFileWriter()
        for i in range(doc.first_page, doc.last_page):
            output.addPage(folder_pdf.getPage(i))
        with open("doc" + str(doc.id) + ".pdf", "wb") as outputStream:
            output.write(outputStream)
        split_doc_to_page(pdf_path, foldername_short, box, folderno, doc.id)

if __name__ == '__main__':
    download_raw_folder_pdf_from_aws(2, 1, 'digital_comp_to_social_problems')
    pass